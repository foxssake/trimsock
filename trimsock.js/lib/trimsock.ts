export interface Command {
  name: string;
  data: Buffer;
}

export interface ParseError {
  error: string;
}

const BS = 0x08;
const NL = 0x0A;
const SP = 0x20;

enum ParserState {
  COMMAND_NAME,
  STRING_DATA,
  BIN_DATA_PREFIX,
  BIN_DATA_BODY,
  BIN_DATA_CLOSE
};

export class Trimsock {
  private maxCommandSize: number = 16384;
  private commandName: string = "";
  private commandDataChunks: Array<Buffer> = [];
  private commandSizeString: string = "";
  private binaryRemaining: number = 0;
  private state: ParserState = ParserState.COMMAND_NAME;

  get status(): object {
    return {
      state: this.state,
      name: this.commandName,
      data: Buffer.concat(this.commandDataChunks),
      size: this.commandSizeString,
      remaining: this.binaryRemaining
    }
  }

  ingest(buffer: Buffer): Array<Command | ParseError> {
    const result: Array<Command | ParseError> = [];
    for (let i = 0; i < buffer.byteLength;) {
      if (this.state == ParserState.COMMAND_NAME) {
        const spPos = buffer.indexOf(SP, i);

        if (spPos < 0) {
          this.commandName += buffer.toString("ascii", i, buffer.length);
          break;
        } else {
          this.commandName += buffer.toString("ascii", i, spPos);
          i = spPos + 1;
          this.state = ParserState.STRING_DATA;
        }
      } else if (this.state == ParserState.STRING_DATA) {
        if (buffer[i] == BS) {
          // Switch to binary
          this.state = ParserState.BIN_DATA_PREFIX;
          i += 1;
          continue;
        }

        const nlPos = buffer.indexOf(NL, i);
        if (nlPos < 0) {
          this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, i));
          break;
        } else {
          this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, i, nlPos - i));
          i = nlPos + 1;
          result.push(this.emitCommand());
        }
      } else if (this.state == ParserState.BIN_DATA_PREFIX) {
        const bsPos = buffer.indexOf(BS, i);

        if (bsPos < 0) {
          this.commandSizeString += buffer.toString("ascii", i);
          break;
        } else {
          this.commandSizeString += buffer.toString("ascii", i, bsPos);
          i = bsPos + 1;

          const size = parseInt(this.commandSizeString);
          if (!isFinite(size)) {
            result.push({ error: `Invalid command size: ${this.commandSizeString}` });
            this.state = ParserState.COMMAND_NAME; // Try parsing more commands
            continue;
          }

          this.state = ParserState.BIN_DATA_BODY;
          this.binaryRemaining = size;
        }
      } else if (this.state == ParserState.BIN_DATA_BODY) {
        const bytesAvailable = Math.min(this.binaryRemaining, buffer.byteLength - i);
        this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, i, bytesAvailable));

        i += bytesAvailable;
        this.binaryRemaining -= bytesAvailable;

        if (this.binaryRemaining == 0)
          this.state = ParserState.BIN_DATA_CLOSE;
      } else if (this.state == ParserState.BIN_DATA_CLOSE) {
        if (buffer[i] != NL)
          result.push({ error: `Expected command terminating byte NL, got ${buffer[i]}!` });
        
        result.push(this.emitCommand());
        this.state = ParserState.COMMAND_NAME;
        i += 1;
      }
    }

    return result;
  }

  asString(command: Command): string {
    return ""; // TODO
  }

  asBinary(command: Command): Buffer {
    return Buffer.of(); // TODO
  }

  private emitCommand(): Command {
    const result = {
      name: this.commandName,
      data: Buffer.concat(this.commandDataChunks)
    }

    this.commandName = "";
    this.commandDataChunks = [];

    return result;
  }
}
