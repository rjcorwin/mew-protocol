import express, { type Request, type Response, type NextFunction } from 'express';
import bodyParser from 'body-parser';
import type { Server } from 'http';

export type MessageHandler = (message: any) => Promise<any> | any;

export interface MessageInputOptions {
  httpPort?: number;
  httpBind?: string;
  fifoIn?: string;
}

export interface MessageInputDescriptor {
  type: 'http';
  server: Server;
}

export function setupHttpInput(
  port: number,
  bind = '127.0.0.1',
  messageHandler: MessageHandler
): Server {
  const app = express();

  app.use(bodyParser.json({ limit: '10mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.2.0',
      endpoints: ['/health', '/message', '/messages']
    });
  });

  app.post('/message', async (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          error: 'Invalid message format',
          code: 'INVALID_FORMAT'
        });
        return;
      }

      if (!req.body.kind) {
        res.status(400).json({
          error: 'Message must have a "kind" field',
          code: 'MISSING_KIND'
        });
        return;
      }

      const result = await messageHandler(req.body);
      res.json(result ?? { success: true, id: req.body.id });
    } catch (error) {
      const err = error as Error;
      console.error('Error handling message:', err);
      res.status(500).json({
        error: err.message || 'Internal server error',
        code: (err as any).code || 'HANDLER_ERROR'
      });
    }
  });

  app.post('/messages', async (req: Request, res: Response) => {
    try {
      if (!req.body || !Array.isArray(req.body.messages)) {
        res.status(400).json({
          error: 'Request must contain a "messages" array',
          code: 'INVALID_BATCH_FORMAT'
        });
        return;
      }

      const results: Array<Record<string, unknown>> = [];
      for (const message of req.body.messages) {
        try {
          if (!message.kind) {
            results.push({
              success: false,
              error: 'Message must have a "kind" field',
              code: 'MISSING_KIND'
            });
            continue;
          }

          const result = await messageHandler(message);
          results.push({
            success: true,
            result: result ?? { id: message.id }
          });
        } catch (error) {
          const err = error as Error;
          results.push({
            success: false,
            error: err.message,
            code: (err as any).code || 'HANDLER_ERROR'
          });
        }
      }

      res.json({ results });
    } catch (error) {
      const err = error as Error;
      console.error('Error handling batch messages:', err);
      res.status(500).json({
        error: err.message || 'Internal server error',
        code: 'BATCH_ERROR'
      });
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      available: ['/health', '/message', '/messages']
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  });

  const server = app.listen(port, bind, () => {
    console.log(`HTTP input server listening on http://${bind}:${port}`);
    console.log(`  Health check: http://${bind}:${port}/health`);
    console.log(`  Send message: POST http://${bind}:${port}/message`);
    console.log(`  Send batch: POST http://${bind}:${port}/messages`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    } else {
      console.error('HTTP server error:', error);
    }
    process.exit(1);
  });

  return server;
}

export class MessageInputManager {
  private readonly options: MessageInputOptions;
  private readonly messageHandler: MessageHandler;
  private readonly inputs: MessageInputDescriptor[] = [];

  constructor(options: MessageInputOptions, messageHandler: MessageHandler) {
    this.options = options;
    this.messageHandler = messageHandler;

    if (options.httpPort) {
      this.setupHttp();
    }

    if (options.fifoIn) {
      this.setupFifo();
    }
  }

  private setupHttp(): void {
    if (!this.options.httpPort) {
      return;
    }

    const server = setupHttpInput(
      this.options.httpPort,
      this.options.httpBind ?? '127.0.0.1',
      this.messageHandler
    );
    this.inputs.push({ type: 'http', server });
  }

  private setupFifo(): void {
    if (this.options.fifoIn) {
      console.log(`FIFO input configured at: ${this.options.fifoIn}`);
    }
  }

  close(): void {
    for (const input of this.inputs) {
      if (input.type === 'http') {
        input.server.close();
      }
    }
  }
}
