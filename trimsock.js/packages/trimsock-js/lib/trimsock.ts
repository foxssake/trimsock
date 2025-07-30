import { Command, type CommandSpec } from "./command.js";
import {
  type Convention,
  MultiparamConvention,
  RequestResponseConvention,
  StreamConvention,
} from "./conventions.js";

export interface ParseError {
  error: string;
}

export type ParserOutput = CommandSpec | ParseError;

enum ParserState {
  CONSUME_TEXT = 0,
  CONSUME_RAW = 1,
  CONSUME_NL = 2,
}

// TODO: Change ingest output so this is not needed
export function isCommand(what: ParserOutput): boolean {
  return (what as CommandSpec).name !== undefined;
}

export class Trimsock {
  private lineBuffer = "";

  private commandName = "";
  private commandDataChunks: Array<Buffer> = [];
  private rawBytesRemaining = 0;
  private state: ParserState = ParserState.CONSUME_TEXT;
  private isIgnoring = false;

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

  ingest(data: Buffer | string): Array<ParserOutput> {
    const results: Array<ParserOutput> = [];
    let remaining = data;

    while (remaining) {
      if (this.state === ParserState.CONSUME_TEXT)
        remaining = this.consumeText(remaining, results);
      else if (this.state === ParserState.CONSUME_RAW)
        remaining = this.consumeRaw(remaining, results);
      else if (this.state === ParserState.CONSUME_NL)
        remaining = this.consumeNl(remaining, results);
    }

    return results.map((item) =>
      isCommand(item) ? this.applyConventions(item as CommandSpec) : item,
    );
  }

  private consumeText(
    data: Buffer | string,
    results: Array<ParserOutput>,
  ): Buffer | string {
    const nlPos = data.indexOf("\n");
    if (nlPos < 0) {
      if (this.lineBuffer.length + data.length > this.maxCommandSize) {
        results.push(
          this.makeCommandLengthError(this.lineBuffer.length + data.length),
        );
        this.isIgnoring = true;
      } else {
        this.lineBuffer += this.asText(data);
      }

      return "";
    }

    if (this.lineBuffer.length + nlPos > this.maxCommandSize) {
      results.push(this.makeCommandLengthError(this.lineBuffer.length + nlPos));

      this.isIgnoring = false;
      this.lineBuffer = "";

      return data.slice(nlPos + 1);
    }

    const line = this.lineBuffer + this.asText(data.slice(0, nlPos));
    const remaining = data.slice(nlPos + 1);

    if (!this.isIgnoring) {
      const spPos = line.indexOf(" ");
      const command: CommandSpec =
        spPos >= 0
          ? { name: line.slice(0, spPos), data: line.slice(spPos + 1) }
          : { name: line, data: "" };

      if (command.name.startsWith("\r")) {
        // Raw
        this.state = ParserState.CONSUME_RAW;
        this.rawBytesRemaining = Number.parseInt(command.data ?? "");
        this.commandName = command.name.slice(1);
        this.commandDataChunks = [];
      } else {
        results.push(this.unescapeCommand(command));
      }
    }

    this.lineBuffer = "";
    this.isIgnoring = false;

    return remaining;
  }

  private consumeRaw(
    data: Buffer | string,
    results: Array<ParserOutput>,
  ): Buffer | string {
    const bufferSize = this.commandDataChunks.reduce((a, b) => a + b.length, 0);

    if (data.length <= this.rawBytesRemaining) {
      if (bufferSize + data.length > this.maxCommandSize) {
        results.push(this.makeCommandLengthError(bufferSize + data.length));
        this.isIgnoring = true;
      } else {
        this.commandDataChunks.push(this.asBuffer(data));
        this.rawBytesRemaining -= data.length;
      }
      return "";
    }

    if (bufferSize + this.rawBytesRemaining > this.maxCommandSize) {
      this.isIgnoring = true;
      results.push(
        this.makeCommandLengthError(bufferSize + this.rawBytesRemaining),
      );
    }

    if (!this.isIgnoring)
      this.commandDataChunks.push(
        this.asBuffer(data.slice(0, this.rawBytesRemaining)),
      );

    const remaining = data.slice(this.rawBytesRemaining);

    if (!this.isIgnoring)
      results.push(
        this.unescapeCommand({
          name: this.commandName,
          raw: Buffer.concat(this.commandDataChunks),
        }),
      );

    this.commandDataChunks = [];
    this.rawBytesRemaining = 0;
    this.state = ParserState.CONSUME_NL;
    this.isIgnoring = false;

    return remaining;
  }

  private consumeNl(
    data: Buffer | string,
    results: Array<ParserOutput>,
  ): Buffer | string {
    const single = data.at(0) ?? 0;
    const character =
      typeof single === "string" ? single : String.fromCodePoint(single);

    if (character !== "\n")
      results.push(this.makeUnexpectedCharacterError("\n", character));

    this.state = ParserState.CONSUME_TEXT;
    return data.slice(1);
  }

  private asText(data: Buffer | string): string {
    if (data instanceof Buffer) return data.toString("utf8");

    return data.toString();
  }

  private asBuffer(data: Buffer | string): Buffer {
    if (typeof data === "string") return Buffer.from(data, "utf8");

    return data;
  }

  private applyConventions(command: CommandSpec): CommandSpec {
    let result = command;
    for (const convention of this.conventions)
      result = convention.process(result);

    return result;
  }

  private makeCommandLengthError(expectedSize: number): ParseError {
    return {
      error: `Expected command length ${expectedSize} is above the allowed ${this.maxCommandSize} bytes!`,
    };
  }

  private makeUnexpectedCharacterError(
    expected: string,
    received: string | number,
  ) {
    const codePoint =
      typeof received === "string" ? received.codePointAt(0) : received;
    const character =
      typeof received === "string"
        ? received.charAt(0)
        : String.fromCodePoint(received);

    return {
      error: `Expected ${expected} after raw command data, got "${character}" ( ${codePoint} )`,
    };
  }

  private unescapeCommand(command: CommandSpec): CommandSpec {
    const result = {
      ...command,
      name: Command.unescapeName(command.name),
      data: command.data && Command.unescapeData(command.data),
    };

    if (result.data === undefined) result.data = undefined;

    return result;
  }
}
