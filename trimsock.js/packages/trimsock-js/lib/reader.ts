import { Command, type CommandDataChunk, type CommandSpec } from "./command.js";
import { MultiparamConvention, RequestResponseConvention, StreamConvention } from "./conventions.js";

class CommandReader {
  public maxSize = 16384 // TODO

  private buffer = Buffer.of()
  private at = 0
  private isQuote = false
  private isEscape = false

  ingest(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data])
  }

  readLine(): string | undefined {
    // Extract a command, if it's terminated
    for (; !this.eob; ++this.at) {
      if (this.isEscape) {
        this.isEscape = false
        continue
      } 

      if (this.char == "\"")
        this.isQuote = !this.isQuote
      if (this.char == "\\") {
        this.isEscape = true
        continue
      }
      if (this.char == "\n" && !this.isQuote) {
        const result = this.buffer.subarray(0, this.at).toString("utf8")
        ++this.at
        this.flush()
        return result
      } 
    }
  }

  readRaw(size: number): Buffer | undefined {
    // Reset line parser
    this.isEscape = false
    this.isQuote = false

    if (this.buffer.length >= size) {
      const result = this.buffer.subarray(0, size)
      this.at = size + 1
      this.flush()

      return result
    }
  }

  private flush() {
    this.buffer = this.buffer.subarray(this.at)
    this.at = 0
  }

  private get byte() {
    return this.buffer[this.at]
  }

  private get char() {
    return String.fromCodePoint(this.byte)
  }

  private get eob() {
    return this.at >= this.buffer.length
  }
}

class CommandParser {
  private line: string = ""
  private at: number = 0

  parse(line: string): CommandSpec {
    this.rewind(line)

    const isRaw = this.char == "\r"
    if (isRaw) this.at++

    const name = this.readName()
    this.at++;

    const chunks: CommandDataChunk[] = []
    while (!this.atEnd && this.char != "\n")
      chunks.push(this.readChunk())

    const text = chunks.map(it => it.text).join("")

    return isRaw
      ? this.unescape({ name, text, raw: Buffer.of() })
      : this.unescape({ name, text, chunks })
  }

  private unescape(command: CommandSpec): CommandSpec {
    const result: CommandSpec = { name: Command.unescape(command.name) }
    if (command.chunks) {
      result.chunks = command.chunks.map(it => ({ ...it, text: Command.unescape(it.text) }))
      result.text = result.chunks.map(it => it.text).join("")
    }

    return {
      ...command,
      ...result
    }
  }

  private rewind(line: string) {
    this.line = line
    this.at = 0
  }

  private readName(): string {
    if (this.char == "\"")
      return this.readQuoted()
    else
      return this.readIdentifier()
  }

  private readChunk(): CommandDataChunk {
    if (this.char == "\"")
      return { isQuoted: true, text: this.readQuoted() }
    else
      return { isQuoted: false, text: this.readUnquoted() }
  }

  private readIdentifier(): string {
    const from = this.at
    for (; this.char != " "; ++this.at)
      if (this.atEnd)
        // TODO: Specific error type
        throw new Error("Unexpected EOF while reading identifier!")
    return this.line.substring(from, this.at)
  }

  private readUnquoted(): string {
    const from = this.at

    for (; ; ++this.at) {
      if (this.char == "\\") {
        this.at++;
        continue;
      }
      if (this.char == "\n" || this.char == "\"")
        break;
      if (this.atEnd)
        break;
    }

    return this.line.substring(from, this.at);
  }

  private readQuoted(): string {
    const from = this.at

    for(this.at++; ; ++this.at) {
      if (this.char == "\\") {
        this.at++;
        continue;
      }
      if (this.char == "\"") {
        this.at++;
        break;
      }
      if (this.atEnd)
        // TODO: Specific error type
        throw new Error("Unexpected EOF while reading quoted!")
    }

    return this.line.substring(from + 1, this.at - 1)
  }

  private get char(): string {
    return this.line[this.at]
  }

  private get atEnd(): boolean {
    return this.at >= this.line.length
  }
}

export class TrimsockReader {
  private reader = new CommandReader();
  private parser = new CommandParser();

  private queuedRawCommand?: CommandSpec
  private queuedRawSize: number = -1

  private conventions = [
    new MultiparamConvention(),
    new RequestResponseConvention(),
    new StreamConvention()
  ]

  ingest(data: Buffer | string) {
    if (typeof data === "string")
      this.reader.ingest(Buffer.from(data, "utf8"))
    else
      this.reader.ingest(data)
  }

  read(): CommandSpec | undefined {
    let command = this.pop()

    if (command)
      for (const convention of this.conventions)
        command = convention.process(command)

    return command
  }

  *commands() {
    while (true) {
      const command = this.read()
      if (!command) break;
      yield command;
    }
  }

  private pop(): CommandSpec | undefined {
    if (this.queuedRawCommand != undefined) {
      const data = this.reader.readRaw(this.queuedRawSize)
      if (!data) return

      const result: CommandSpec = {
        name: this.queuedRawCommand.name,
        raw: data
      }

      this.queuedRawCommand = undefined
      return result
    }

    const line = this.reader.readLine();
    if (!line) return;

    const command = this.parser.parse(line);
    if (command.raw !== undefined) {
      this.queuedRawCommand = command
      this.queuedRawSize = parseInt(command.text!!)
      return this.read()
    }

    return command;
  }
}
