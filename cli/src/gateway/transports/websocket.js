const EventEmitter = require('events');
const WebSocket = require('ws');

class WebSocketTransport extends EventEmitter {
  constructor({ host = '127.0.0.1', port = 4700, logger }) {
    super();
    this.host = host;
    this.port = port;
    this.logger = logger || console;
    this.server = null;
    this.connections = new Set();
  }

  async start() {
    if (this.server) return;

    this.logger.log(`Starting WebSocket transport on ws://${this.host}:${this.port}`);

    this.server = new WebSocket.Server({ host: this.host, port: this.port });

    this.server.on('connection', (socket) => {
      const connection = {
        socket,
        participantId: null,
      };
      this.connections.add(connection);

      const channel = {
        send: (envelope) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          try {
            socket.send(JSON.stringify(envelope));
          } catch (error) {
            this.logger.warn('Failed to send envelope over WebSocket:', error.message);
          }
        },
        close: () => {
          try {
            socket.close();
          } catch (error) {
            // ignore
          }
        },
        setParticipantId: (participantId) => {
          connection.participantId = participantId;
        },
      };

      socket.on('message', (data) => {
        try {
          const text = data.toString();
          const envelope = JSON.parse(text);
          this.emit('message', {
            participantId: connection.participantId,
            envelope,
            channel,
          });
        } catch (error) {
          this.logger.warn('Failed to parse WebSocket message:', error.message);
        }
      });

      socket.on('close', () => {
        this.connections.delete(connection);
        this.emit('disconnect', {
          participantId: connection.participantId,
          channel,
        });
      });

      socket.on('error', (error) => {
        this.emit('error', error);
      });
    });

    this.server.on('error', (error) => {
      this.emit('error', error);
    });

    await new Promise((resolve, reject) => {
      this.server.once('listening', resolve);
      this.server.once('error', reject);
    });
  }

  async stop() {
    if (!this.server) return;
    await new Promise((resolve) => {
      this.server.close(() => resolve());
    });
    this.server = null;
    this.connections.clear();
  }
}

module.exports = {
  WebSocketTransport,
};
