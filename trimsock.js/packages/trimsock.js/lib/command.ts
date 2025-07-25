import assert from "./assert";

export interface BaseCommandSpec {
  name: string;
  data?: string;
  raw?: Buffer;
}

interface MultiparamCommandSpec extends BaseCommandSpec {
  params?: Array<string>;
}

interface RequestResponseCommandSpec extends BaseCommandSpec {
  requestId?: string;

  isRequest?: boolean;
  isSuccessResponse?: boolean;
  isErrorResponse?: boolean;
}

interface StreamCommandSpec extends BaseCommandSpec {
  streamId?: string;

  isStreamChunk?: boolean;
  isStreamEnd?: boolean;
}

export interface CommandSpec
  extends BaseCommandSpec,
    MultiparamCommandSpec,
    RequestResponseCommandSpec,
    StreamCommandSpec {}

export class Command implements CommandSpec {
  name: string;
  data?: string | undefined;
  raw?: Buffer | undefined;
  params?: string[] | undefined;
  requestId?: string | undefined;
  isRequest?: boolean | undefined;
  isSuccessResponse?: boolean | undefined;
  isErrorResponse?: boolean | undefined;
  streamId?: string | undefined;
  isStreamChunk?: boolean | undefined;
  isStreamEnd?: boolean | undefined;

  constructor(spec: CommandSpec) {
    this.name = spec.name;
    this.data = spec.data;
    Object.assign(this, spec);
  }

  get id(): string | undefined {
    return this.streamId ?? this.requestId;
  }

  get isClosing(): boolean {
    return this.isResponse || this.isStreamEnd || false;
  }

  get isResponse(): boolean {
    return this.isSuccessResponse || this.isErrorResponse || false;
  }

  get isStream(): boolean {
    return this.isStreamChunk || this.isStreamEnd || false;
  }

  get isSimple(): boolean {
    return !this.isRequest && !this.isResponse && !this.isStream;
  }

  get isRaw(): boolean {
    return this.raw !== undefined;
  }

  requireId(): string {
    assert(this.id !== undefined, "No request or stream ID is present!");
    return this.id;
  }

  requireParams(amount?: number): Array<string> {
    if (amount === undefined)
      assert(this.params !== undefined, "This command requires params!");
    else
      assert(
        this.params !== undefined && this.params.length === amount,
        `This command requires ${amount} params!`,
      );

    return this.params;
  }

  requireParam(index: number): string {
    return this.requireParams()[index];
  }

  requireRaw(): Buffer {
    assert(this.raw !== undefined, "Command has no raw data!");
    return this.raw;
  }

  requireText(): string {
    assert(this.data !== undefined, "Command has no text data!");
    return this.data;
  }

  serialize(): string {
    return Command.serialize(this);
  }

  static serialize(spec: CommandSpec): string {
    let name = "";

    // Figure out final spec.name
    if (spec.isStreamChunk || spec.isStreamEnd)
      name = `${spec.name}|${spec.streamId}`;
    else if (spec.isRequest) name = `${spec.name}?${spec.requestId}`;
    else if (spec.isSuccessResponse) name = `${spec.name}.${spec.requestId}`;
    else if (spec.isErrorResponse) name = `${spec.name}!${spec.requestId}`;
    else name = spec.name;

    name = Command.escapeName(name);

    // Early return for raw spec.
    if (spec.raw)
      return spec.raw.byteLength !== 0
        ? `\r${name} ${spec.raw.byteLength}\n${spec.raw.toString("ascii")}\n`
        : `${name} \n`;

    // Figure out data
    let data = "";
    if (spec.params)
      data = spec.params.map((it) => Command.escapeData(it)).join(" ");
    else data = Command.escapeData(spec.data ?? "");

    return `${name} ${data}\n`;
  }

  static escapeName(name: string): string {
    return name
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r")
      .replaceAll(" ", "\\s");
  }

  static escapeData(data: string): string {
    return data
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r")
      .replaceAll(" ", "\\s");
  }

  static unescapeName(data: string): string {
    return data
      .replaceAll("\\s", " ")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r");
  }

  static unescapeData(data: string): string {
    return data.replaceAll("\\n", "\n").replaceAll("\\r", "\r");
  }
}
