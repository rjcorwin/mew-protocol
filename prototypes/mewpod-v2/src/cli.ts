import { resolve } from 'node:path';
import { createDemo } from './demo.js';
import { createConsoleServer } from './server.js';
import { JsonFileStore } from './store.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Mewpod v2 local mock prototype\n  npm run mewpod -- [--port 8087] [--data .mewpod/work-record.json] [--new-scope]\n  npm run demo:mewpod\nNo live workspace, model, provider, or repository access.'); return; }
  let port = 8087; let path = '.mewpod/work-record.json'; let demo = false; let newScope = false;
  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case '--port': port = Number(args[++index]); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port'); break;
      case '--data': if (!args[index + 1]) throw new Error('Missing data path'); path = args[++index]; break;
      case '--demo': demo = true; break;
      case '--new-scope': newScope = true; break;
      default: throw new Error('Unknown argument; use --help');
    }
  }
  if (demo) {
    const pod = createDemo({ delayMs: 30 });
    await pod.postMessage({ text: '@builder Prepare a small change and ask for a review here.', conversationId: 'project', threadId: 'ticket-a' });
    await pod.postMessage({ text: 'Human clarification: retain the existing behavior.', conversationId: 'project', threadId: 'ticket-a' });
    await pod.postMessage({ text: '@catalog Which example repositories are in scope?', conversationId: 'project', threadId: 'ticket-b' });
    await pod.idle();
    const snapshot = pod.snapshot();
    console.log(JSON.stringify({ mode: 'offline-mock', messages: snapshot.messages, tasks: snapshot.tasks, capacity: snapshot.capacity }, null, 2));
    const verified = snapshot.tasks.length === 3 && snapshot.tasks.every(task => task.status === 'completed' && snapshot.messages.some(message => message.id === task.completionMessageId && message.authorId === task.entityId && message.threadId === task.threadId && pod.workspace.verify(message)));
    pod.dispose();
    if (!verified) throw new Error('Demo did not reach verified completion');
    console.log('VERIFIED: three background tasks completed with replies in their originating threads. Mock/local only.');
    return;
  }
  const store = new JsonFileStore(resolve(path));
  let pod: ReturnType<typeof createDemo>;
  try { pod = createDemo({ store, initialState: store.load(), newScope }); }
  catch (error) { store.close(); throw error; }
  const server = createConsoleServer({ snapshot: () => pod.snapshot(), postMessage: input => pod.postMessage(input), setCapacity: value => pod.setCapacity(value), cancelTask: id => pod.cancelTask(id), endScope: id => pod.endScope(id) });
  server.on('error', () => { console.error('Console failed to listen; check the port.'); pod.dispose(); store.close(); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Mewpod v2 local mock console: http://127.0.0.1:${port}\nWork record: ${resolve(path)}\nTry “@builder prepare a change” in project / ticket-a.\nNo live Slack, model, provider, or repository calls.`);
    if (!pod.snapshot().scopes.some(scope => scope.status === 'active')) console.log('Prior scopes are closed. Restart with --new-scope to explicitly begin another work period.');
  });
  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) return; closing = true;
    server.close();
    try {
      for (const scope of pod.snapshot().scopes.filter(scope => scope.status === 'active')) pod.endScope(scope.id);
      await pod.idle();
    } catch { console.error('Shutdown could not confirm every task outcome; the saved work record may be incomplete.'); }
    finally { pod.dispose(); store.close(); }
  };
  process.once('SIGINT', () => { void close(); }); process.once('SIGTERM', () => { void close(); });
}

main().catch(() => { console.error('Mewpod could not complete the requested operation. Check arguments, work-record validity, and whether another process owns its .lock file. No automatic retry.'); process.exitCode = 1; });
