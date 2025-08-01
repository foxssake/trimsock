import assert from "./assert.js";

/**
* Describes the core data fields of a command, without conventions
* @public
*/
export interface BaseCommandSpec {
  /**
  * The command name
  */
  name: string;

  /**
  * Command data
  *
  * For raw commands, `data` is undefined, and {@link raw} is used instead.
  */
  data?: string;

  /**
  * Raw command data
  *
  * For regular commands, `raw` is undefined, and {@link data} is used.
  */
  raw?: Buffer;
}

interface MultiparamCommandSpec extends BaseCommandSpec {
  /**
  * Command parameters parsed from {@link data}
  *
  * Undefined if the data does not contain multiple parameters.
  */
  params?: Array<string>;
}

interface RequestResponseCommandSpec extends BaseCommandSpec {
  /**
  * Request ID, used to associate responses with requests
  */
  requestId?: string;

  /**
  * Flag marking requests
  *
  * Exclusive with the other flags.
  */
  isRequest?: boolean;

  /**
  * Flag marking success responses
  *
  * If this flag is true, the other peer has succesfully processed the request,
  * and this command contains its response. Exclusive with the other flags.
  */
  isSuccessResponse?: boolean;

  /**
  * Flag marking error responses
  *
  * If this flag is true, the other peer has failed to process the request, and
  * this command signifies that, optionally carrying information about the
  * error. Exclusive with the other flags.
  */
  isErrorResponse?: boolean;
}

interface StreamCommandSpec extends BaseCommandSpec {
  /**
  * Stream ID, used to associate data chunks with streams
  */
  streamId?: string;

  /**
  * Flag marking stream chunks
  *
  * If this flag is true, this command carries a chunk of data belonging to a
  * stream. Exclusive with the other flags.
  */
  isStreamChunk?: boolean;

  /**
  * Flag marking a stream's end
  *
  * If this flag is true, this command closes the stream, meaning no more data
  * should be expected. Exclusive with the other flags.
  */
  isStreamEnd?: boolean;
}

/**
* Describes all the data in a command, including conventions
* @public
*/
export interface CommandSpec
  extends BaseCommandSpec,
    MultiparamCommandSpec,
    RequestResponseCommandSpec,
    StreamCommandSpec {}

/**
* Specifies a {@link CommandSpec}, while implementing utility methods
* @public
*/
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

  /**
  * Exchange ID - this can be either the stream or the request ID, or undefined
  * if the command has no identifier
  */
  get id(): string | undefined {
    return this.streamId ?? this.requestId;
  }

  /**
  * Whether the command closes an exchange or not
  *
  * If this is true, no more commands should are expected with the same {@link
  * id}.
  */
  get isClosing(): boolean {
    return this.isResponse || this.isStreamEnd || false;
  }

  /**
  * Whether the command is a response or not
  *
  * If this is true, the command is either a success or an error response, sent
  * after the sender has processed a previous request.
  */
  get isResponse(): boolean {
    return this.isSuccessResponse || this.isErrorResponse || false;
  }

  /**
  * Whether the command belongs to a stream or not
  *
  * If this is true, the command is either a stream chunk or a stream end
  * marker.
  */
  get isStream(): boolean {
    return this.isStreamChunk || this.isStreamEnd || false;
  }

  /**
  * Whether this command uses conventions or not
  *
  * If this is true, it means that no conventions are used, the command is in
  * the form of `<command> <data>\n`. In other words, this command does not
  * belong to a request, a stream, or other convention.
  *
  * Note that multiparam commands can still be considered simple.
  */
  get isSimple(): boolean {
    return !this.isRequest && !this.isResponse && !this.isStream;
  }

  /**
  * Whether this command contains raw data or not
  */
  get isRaw(): boolean {
    return this.raw !== undefined;
  }

  /**
  * Return the command's {@link id}, or throw if there's no id to return
  */
  requireId(): string {
    assert(this.id !== undefined, "No request or stream ID is present!");
    return this.id;
  }

  /**
  * Return the command's {@link params}, or throw if they're not defined
  *
  * @param amount the number of required parameters; omit if no parameter count
  * validation is needed
  */
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

  /**
  * Return a parameter by index, or throw if it's not defined
  *
  * @param index parameter index
  */
  requireParam(index: number): string {
    return this.requireParams()[index];
  }

  /**
  * Return the command's {@link raw} data, or throw if it's not present
  */
  requireRaw(): Buffer {
    assert(this.raw !== undefined, "Command has no raw data!");
    return this.raw;
  }

  /**
  * Return the command's text {@link data}, or throw if it's not present
  */
  requireText(): string {
    assert(this.data !== undefined, "Command has no text data!");
    return this.data;
  }

  /**
  * Serialize the command into a string, that can be transmitted over trimsock
  */
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

    return data ? `${name} ${data}\n` : `${name}\n`;
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
