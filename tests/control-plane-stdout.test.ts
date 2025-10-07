import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { ControlPlaneStdout } from '../src/cli/utils/control-plane-stdout.js';

describe('ControlPlaneStdout', () => {
  it('resets the current frame when a RIS sequence is received', async () => {
    const target = new PassThrough();
    (target as unknown as { columns: number }).columns = 90;
    (target as unknown as { rows: number }).rows = 24;

    const stdout = new ControlPlaneStdout(target);

    await new Promise<void>((resolve) => stdout.write('Control plane listening on http://localhost:7777\n', resolve));
    await new Promise<void>((resolve) => stdout.write('\u001bc', resolve));
    await new Promise<void>((resolve) => stdout.write(' ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n', resolve));

    const snapshot = stdout.snapshot();

    expect(snapshot.current.lines[0]).toContain('▔');
    expect(snapshot.current.plain).not.toContain('Control plane listening');
  });
});
