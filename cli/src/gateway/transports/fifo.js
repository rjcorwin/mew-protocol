const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { encodeEnvelope, FrameParser } = require('../../stdio/utils');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPath(targetPath, { timeoutMs = 5000, pollMs = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await sleep(pollMs);
    }
  }
  throw new Error(`Timed out waiting for FIFO at ${targetPath}`);
}

class FIFOTransport extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.fifoDir - Directory containing FIFO pairs
   * @param {Iterable<string>} options.participantIds
   * @param {object} [options.logger]
   */
  constructor({ fifoDir, participantIds, logger }) {
    super();
    this.fifoDir = fifoDir;
    this.participantIds = [...participantIds];
    this.logger = logger || console;
    this.channels = new Map();
    this.started = false;
  }

  async start() {
    if (this.started) return;
    this.started = true;

    await Promise.all(
      this.participantIds.map((participantId) => this.#setupChannel(participantId)),
    );
  }

  async #setupChannel(participantId) {
    const toParticipantPath = path.join(this.fifoDir, `${participantId}.in`);
    const fromParticipantPath = path.join(this.fifoDir, `${participantId}.out`);

    await waitForPath(toParticipantPath);
    await waitForPath(fromParticipantPath);

    this.logger.log(
      `FIFO transport attaching to ${participantId} using ${fromParticipantPath} -> ${toParticipantPath}`,
    );

    const readStream = fs.createReadStream(fromParticipantPath);
    const writeStream = fs.createWriteStream(toParticipantPath);

    const channel = {
      participantId,
      send: (envelope) => {
        const payload = encodeEnvelope(envelope);
        if (!writeStream.write(payload)) {
          this.logger.warn(`Backpressure writing to participant ${participantId}`);
        }
      },
      close: () => {
        closed = true;
        writeStream.end();
        readStream.destroy();
      },
    };

    this.channels.set(participantId, channel);

    const parser = new FrameParser((envelope) => {
      this.emit('message', { participantId, envelope, channel });
    });

    let closed = false;
    const emitDisconnect = () => {
      if (closed) return;
      closed = true;
      this.emit('disconnect', { participantId, channel });
    };

    readStream.on('data', (chunk) => {
      try {
        parser.push(chunk);
      } catch (error) {
        this.emit('error', error);
      }
    });
    readStream.on('end', emitDisconnect);
    readStream.on('close', emitDisconnect);
    readStream.on('error', (error) => {
      if (error.code === 'EPIPE') {
        emitDisconnect();
        return;
      }
      this.emit('error', error);
    });

    writeStream.on('error', (error) => {
      if (error.code === 'EPIPE') {
        emitDisconnect();
        return;
      }
      this.emit('error', error);
    });
  }

  /**
   * Sends an envelope to a participant.
   */
  send(participantId, envelope) {
    const channel = this.channels.get(participantId);
    if (!channel) {
      throw new Error(`Unknown participant channel ${participantId}`);
    }
    channel.send(envelope);
  }
}

module.exports = {
  FIFOTransport,
};
