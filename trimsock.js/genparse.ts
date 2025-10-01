interface Command {
  command: string
  data: string
  raw?: Buffer
  chunks?: CommandDataChunk[]
  isRaw: boolean
}

interface CommandDataChunk {
  data: string
  isQuoted: boolean
}

class CommandStream {
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
        console.log("[lin]", result)
        ++this.at
        this.flush()
        console.log("[li>]", this.buffer.toString("utf8"))
        return result
      } 
    }
  }

  readRaw(size: number): Buffer | undefined {
    // Reset line parser
    this.isEscape = false
    this.isQuote = false

    console.log("[li@]", this.buffer.length, "/", size, ":", this.buffer.toString("utf8"))

    if (this.buffer.length >= size) {
      const result = this.buffer.subarray(0, size)
      this.at = size + 1
      this.flush()

      console.log("[li^]", result.toString("utf8"))
      console.log("[lir]", this.buffer.toString("utf8"))
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

  parse(line: string): Command {
    this.rewind(line)
    console.log("[par]", line)

    const isRaw = this.char == "\r"
    if (isRaw) this.at++

    const command = this.readName()
    this.at++;
    console.log("[nam]", this.char)

    const chunks: CommandDataChunk[] = []
    while (!this.atEnd && this.char != "\n")
      chunks.push(this.readChunk())

    const data = chunks.map(it => it.data).join()

    return { command, data, chunks, isRaw }
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
      return { isQuoted: true, data: this.readQuoted() }
    else
      return { isQuoted: false, data: this.readUnquoted() }
  }

  private readIdentifier(): string {
    const from = this.at
    for (; this.char != " "; ++this.at)
      if (this.atEnd)
        throw new Error("Unexpected EOF while reading identifier!")
    return this.line.substring(from, this.at)
  }

  private readUnquoted(): string {
    const from = this.at

    process.stdout.write("[unq]")
    for (; ; ++this.at) {
      process.stdout.write(' ' + this.char)
      if (this.char == "\\") {
        this.at++;
        continue;
      }
      if (this.char == "\n" || this.char == "\"")
        break;
      if (this.atEnd)
        break;
    }
    process.stdout.write("\n")

    console.log("[unq]", this.line.substring(from, this.at))
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
        throw new Error("Unexpected EOF while reading quoted!")
    }

    console.log("[quo]", this.line.substring(from, this.at), this.char)
    return this.line.substring(from + 1, this.at - 1)
  }

  private get char(): string {
    return this.line[this.at]
  }

  private get atEnd(): boolean {
    return this.at >= this.line.length
  }
}

class Parser {
  private stream: CommandStream = new CommandStream()
  private parser: CommandParser = new CommandParser()

  private queuedRawCommand?: Command
  private queuedRawSize: number = -1

  ingest(data: Buffer | string) {
    if (typeof data === "string")
      this.stream.ingest(Buffer.from(data, "utf8"))
    else
      this.stream.ingest(data)
  }

  read(): Command | undefined {
    if (this.queuedRawCommand != undefined) {
      const data = this.stream.readRaw(this.queuedRawSize)
      if (!data) return

      const result: Command = {
        ...this.queuedRawCommand,
        data: "",
        chunks: undefined,
        raw: data
      }

      this.queuedRawCommand = undefined
      return result
    }

    const line = this.stream.readLine();
    if (!line) return;

    const command = this.parser.parse(line);
    if (command.isRaw) {
      this.queuedRawCommand = command
      this.queuedRawSize = parseInt(command.data)
      return this.read()
    }

    return command;
  }

  *commands() {
    while (true) {
      const command = this.read()
      if (!command) break;
      yield command
    }
  }
}

const parser = new Parser();
;["hel", "lo ", "\"wor\\", "\"ld\"\n\"f", "oo bar\" quix \"mux\"\n", "\r\"HUHB\" 4\nabcd\nfoo bar\n"]
  .forEach(it => {
    console.log("[inp]", it)
    parser.ingest(it)
    console.log("[cmd]", [...parser.commands()])
  })
