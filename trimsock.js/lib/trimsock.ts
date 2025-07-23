import { Command, type CommandSpec } from "./command";
import {
  type Convention,
  MultiparamConvention,
  RequestResponseConvention,
  StreamConvention,
} from "./conventions";

export interface ParseError {
  error: string;
}

export type ParserOutput = CommandSpec | ParseError;

const NL = 0x0a;
const SP = 0x20;

enum ParserState {
  COMMAND_NAME = 0,
  STRING_DATA = 1,
  RAW_DATA = 2,
  SKIP_TO_NL = 3,
  SKIP_RAW = 4,
}

// TODO: Change ingest output so this is not needed
export function isCommand(what: ParserOutput): boolean {
  return (what as CommandSpec).name !== undefined;
}

export class Trimsock {
  private commandName = "";
  private commandDataChunks: Array<Buffer> = [];
  private rawBytesRemaining = 0;
  private state: ParserState = ParserState.COMMAND_NAME;

  private conventions: Array<Convention> = [];

  public maxCommandSize = 16384;

  withConventions(): Trimsock {
    this.conventions = [
      new MultiparamConvention(),
      new RequestResponseConvention(),
      new StreamConvention(),
    ];

    return this;
  }

  ingest(buffer: Buffer): Array<ParserOutput> {
    const result: Array<ParserOutput> = [];
    for (let i = 0; i < buffer.byteLength && i >= 0; ) {
      switch (this.state) {
        case ParserState.COMMAND_NAME:
          i = this.ingestCommandName(buffer, i, result);
          break;
        case ParserState.STRING_DATA:
          i = this.ingestStringBody(buffer, i, result);
          break;
        case ParserState.RAW_DATA:
          i = this.ingestRawBody(buffer, i, result);
          break;
        case ParserState.SKIP_TO_NL:
          i = this.ingestSkipToNl(buffer, i);
          break;
        case ParserState.SKIP_RAW:
          i = this.ingestSkipRaw(buffer, i, result);
          break;
      }
    }

    return result.map((item) =>
      isCommand(item) ? this.applyConventions(item as CommandSpec) : item,
    );
  }

  private applyConventions(command: CommandSpec): CommandSpec {
    let result = command;
    for (const convention of this.conventions)
      result = convention.process(result);

    return result;
  }

  private ingestCommandName(
    buffer: Buffer,
    at: number,
    output: Array<ParserOutput>,
  ): number {
    let spPos = buffer.indexOf(SP, at);

    if (spPos < 0) spPos = buffer.byteLength;
    else this.state = ParserState.STRING_DATA;

    const expectedSize = this.queuedCommandLength() + (spPos - at);
    if (expectedSize > this.maxCommandSize) {
      output.push({
        error: `Expected command length ${expectedSize} is above the allowed ${this.maxCommandSize} bytes!`,
      });
      this.state = ParserState.SKIP_TO_NL;
      this.clearCommand();
    } else {
      this.commandName += buffer.toString("utf8", at, spPos);
    }

    return spPos + 1;
  }

  private ingestStringBody(
    buffer: Buffer,
    at: number,
    output: Array<ParserOutput>,
  ): number {
    let nlPos = buffer.indexOf(NL, at);
    const isTerminated = nlPos >= 0;

    if (nlPos < 0) nlPos = buffer.byteLength;
    else this.state = ParserState.COMMAND_NAME;

    const expectedSize = this.queuedCommandLength() + (nlPos - at);

    if (expectedSize > this.maxCommandSize) {
      output.push({
        error: `Expected command length ${expectedSize} is above the allowed ${this.maxCommandSize} bytes!`,
      });
      this.state = ParserState.SKIP_TO_NL;
      this.clearCommand();
      return nlPos + 1;
    }

    this.commandDataChunks.push(Buffer.copyBytesFrom(buffer, at, nlPos - at));
    if (isTerminated) {
      // TODO: Extract to method
      if (this.commandName.at(0) === "\r") {
        // Raw data
        const sizeString = Buffer.concat(this.commandDataChunks).toString(
          "utf8",
        );
        this.rawBytesRemaining = Number.parseInt(sizeString);

        if (!Number.isFinite(this.rawBytesRemaining)) {
          output.push({ error: `Invalid size string: ${sizeString}` });
          return nlPos + 1;
        }

        if (this.rawBytesRemaining > this.maxCommandSize) {
          output.push({
            error: `Queued raw data of ${sizeString} bytes is larger than max command size of ${this.maxCommandSize} bytes`,
          });
          this.state = ParserState.SKIP_RAW;
          return nlPos + 1;
        }

        this.state = ParserState.RAW_DATA;
        this.commandDataChunks = [];
      } else output.push(this.emitCommand());
    }

    return nlPos + 1;
  }

  private ingestRawBody(
    buffer: Buffer,
    at: number,
    output: Array<ParserOutput>,
  ): number {
    if (this.rawBytesRemaining === 0) {
      // Bytes already ingested, waiting for terminating newline
      this.state = ParserState.COMMAND_NAME;

      if (buffer.at(at) !== NL) {
        output.push({
          error: `Expected NL after raw command data, got "${String.fromCodePoint(buffer.at(at) ?? 0)}" ( ${buffer.at(at)} )`,
        });
      }

      return at + 1;
    }

    const bytesAvailable = Math.min(buffer.length - at, this.rawBytesRemaining);
    this.commandDataChunks.push(
      Buffer.copyBytesFrom(buffer, at, bytesAvailable),
    );
    this.rawBytesRemaining -= bytesAvailable;

    if (this.rawBytesRemaining === 0) {
      output.push(this.emitRawCommand());
    }

    return at + bytesAvailable;
  }

  private ingestSkipToNl(buffer: Buffer, at: number): number {
    const nlPos = buffer.indexOf(NL, at);
    if (nlPos >= 0) {
      this.state = ParserState.COMMAND_NAME;
      return nlPos + 1;
    }
    return -1;
  }

  private ingestSkipRaw(
    buffer: Buffer,
    at: number,
    output: Array<ParserOutput>,
  ): number {
    if (this.rawBytesRemaining === 0) {
      // Bytes already ingested, waiting for terminating newline
      this.state = ParserState.COMMAND_NAME;

      if (buffer.at(at) !== NL) {
        output.push({
          error: `Expected NL after raw command data, got "${String.fromCodePoint(buffer.at(at) ?? 0)}" ( ${buffer.at(at)} )`,
        });
      }

      this.clearCommand();
      return at + 1;
    }

    const bytesAvailable = Math.min(buffer.length - at, this.rawBytesRemaining);
    this.commandDataChunks.push(
      Buffer.copyBytesFrom(buffer, at, bytesAvailable),
    );
    this.rawBytesRemaining -= bytesAvailable;

    return at + bytesAvailable;
  }

  private emitCommand(): CommandSpec {
    const data = Buffer.concat(this.commandDataChunks).toString("utf8");

    const result = {
      name: Command.unescapeName(this.commandName),
      data: Command.unescapeData(data),
    };

    this.clearCommand();
    return result;
  }

  private emitRawCommand(): CommandSpec {
    const name = Command.unescapeData(this.commandName.substring(1));
    const data = Buffer.concat(this.commandDataChunks);

    this.clearCommand();

    return { name, raw: data };
  }

  private clearCommand(): void {
    this.commandName = "";
    this.commandDataChunks = [];
  }

  private queuedCommandLength(): number {
    // +2 for the separating space and terminating nl
    return (
      this.commandName.length +
      this.commandDataChunks.reduce((a, b) => a + b.byteLength, 0) +
      2
    );
  }
}
