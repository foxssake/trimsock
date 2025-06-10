export interface Command {
  name: string;
  data: Buffer;
}

export interface ParseError {
  error: string;
}

const BS = 0x08;
const NL = 0x0a;
const SP = 0x20;

enum ParserState {
  COMMAND_NAME = 0,
  STRING_DATA = 1,
  BIN_DATA_PREFIX = 2,
  BIN_DATA_BODY = 3,
  BIN_DATA_CLOSE = 4,
}

export class Trimsock {
  private commandName = "";
  private commandDataChunks: Array<Buffer> = [];
  private commandSizeString = "";
  private binaryRemaining = 0;
  private state: ParserState = ParserState.COMMAND_NAME;

  public maxCommandSize = 16384;

  ingest(buffer: Buffer): Array<Command | ParseError> {
    const result: Array<Command | ParseError> = [];
    for (let i = 0; i < buffer.byteLength && i >= 0; ) {
      switch (this.state) {
        case ParserState.COMMAND_NAME:
          i = this.ingestCommandName(buffer, i, result);
          break;
        case ParserState.STRING_DATA:
          i = this.ingestStringBody(buffer, i, result);
          break;
        case ParserState.BIN_DATA_PREFIX:
          i = this.ingestBinPrefix(buffer, i, result);
          break;
        case ParserState.BIN_DATA_BODY:
          i = this.ingestBinBody(buffer, i, result);
          break;
        case ParserState.BIN_DATA_CLOSE:
          i = this.ingestBinEnd(buffer, i, result);
          break;
      }
    }

    return result;
  }

  asString(command: Command): string {
    return `${this.escapeCommandName(command.name)} ${this.escapeCommandData(command.data)}\n`;
  }

  asBinary(command: Command): Buffer {
    return Buffer.concat([
      Buffer.from(
        `${this.escapeCommandName(command.name)} \b${command.data.byteLength}\b`,
        "ascii",
      ),
      command.data,
      Buffer.from("\n", "ascii"),
    ]);
  }

  private ingestCommandName(
    buffer: Buffer,
    at: number,
    output: Array<Command | ParseError>,
  ): number {
    const spPos = buffer.indexOf(SP, at);

    if (spPos < 0) {
      this.commandName += buffer.toString("ascii", at, buffer.length);
      return -1;
    }

    this.commandName += buffer.toString("ascii", at, spPos);
    this.state = ParserState.STRING_DATA;
    return spPos + 1;
  }

  private ingestStringBody(
    buffer: Buffer,
    at: number,
    output: Array<Command | ParseError>,
  ): number {
    if (buffer[at] === BS) {
      // Switch to binary
      this.state = ParserState.BIN_DATA_PREFIX;
      return at + 1;
    }

    const nlPos = buffer.indexOf(NL, at);
    if (nlPos < 0) {
      this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, at));
      return -1;
    }
    this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, at, nlPos - at));
    output.push(this.emitCommand());
    return nlPos + 1;
  }

  private ingestBinPrefix(
    buffer: Buffer,
    at: number,
    output: Array<Command | ParseError>,
  ): number {
    const bsPos = buffer.indexOf(BS, at);

    if (bsPos < 0) {
      this.commandSizeString += buffer.toString("ascii", at);
      return -1;
    }
    this.commandSizeString += buffer.toString("ascii", at, bsPos);

    const size = Number.parseInt(this.commandSizeString);
    if (!Number.isFinite(size)) {
      output.push({
        error: `Invalid command size: ${this.commandSizeString}`,
      });
      this.state = ParserState.COMMAND_NAME; // Try parsing more commands
      return at + 1;
    }

    this.state = ParserState.BIN_DATA_BODY;
    this.binaryRemaining = size;

    return bsPos + 1;
  }

  private ingestBinBody(
    buffer: Buffer,
    at: number,
    output: Array<Command | ParseError>,
  ): number {
    const bytesAvailable = Math.min(
      this.binaryRemaining,
      buffer.byteLength - at,
    );
    this.commandDataChunks.push(
      Buffer.copyBytesFrom(buffer, at, bytesAvailable),
    );

    this.binaryRemaining -= bytesAvailable;
    if (this.binaryRemaining === 0) this.state = ParserState.BIN_DATA_CLOSE;

    return at + bytesAvailable;
  }

  private ingestBinEnd(
    buffer: Buffer,
    at: number,
    output: Array<Command | ParseError>,
  ): number {
    if (buffer[at] !== NL)
      output.push({
        error: `Expected command terminating byte NL, got ${buffer[at]}!`,
      });

    output.push(this.emitCommand());
    this.state = ParserState.COMMAND_NAME;
    return at + 1;
  }

  private emitCommand(): Command {
    const result = {
      name: this.commandName,
      data: Buffer.concat(this.commandDataChunks),
    };

    this.commandName = "";
    this.commandDataChunks = [];

    return result;
  }

  private escapeCommandName(name: string): string {
    if (name.includes("\n") || name.includes("\b") || name.includes(" ")) {
      return name
        .replaceAll("\n", "\\n")
        .replaceAll("\b", "\\b")
        .replaceAll(" ", "\\s");
    }

    return name;
  }

  private escapeCommandData(buffer: Buffer): string {
    const data = buffer.toString("ascii");
    if (data.includes("\n") || data.includes("\b")) {
      // Escape data if needed
      return data.replaceAll("\n", "\\n").replaceAll("\b", "\\b");
    }

    return data;
  }
}
