const { StringDecoder } = require('string_decoder');

function encodeEnvelope(envelope) {
  const content = JSON.stringify(envelope);
  const length = Buffer.byteLength(content, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${content}`;
}

class FrameParser {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buffer = Buffer.alloc(0);
    this.decoder = new StringDecoder('utf8');
    this.expectedLength = null;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this._process();
  }

  end() {
    if (this.buffer.length > 0) {
      this._process();
    }
  }

  _process() {
    while (true) {
      if (this.expectedLength === null) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = this.buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length: (\d+)/i);
        if (!match) {
          throw new Error('Invalid frame header');
        }
        this.expectedLength = Number(match[1]);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.buffer.length < this.expectedLength) {
        return;
      }

      const messageBuffer = this.buffer.slice(0, this.expectedLength);
      this.buffer = this.buffer.slice(this.expectedLength);
      this.expectedLength = null;

      const json = this.decoder.write(messageBuffer);
      const data = JSON.parse(json);
      this.onMessage(data);
    }
  }
}

module.exports = {
  encodeEnvelope,
  FrameParser,
};
