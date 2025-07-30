import assert from "./assert.js";
import { Command, type CommandSpec } from "./command.js";
import { Trimsock, isCommand } from "./trimsock.js";

export type CommandHandler<T> = (
  command: Command,
  exchange: Exchange<T>,
) => void;

export type CommandErrorHandler<T> = (
  command: Command,
  exchange: Exchange<T>,
  error: unknown,
) => void;

export type ExchangeIdGenerator = () => string;

function generateCryptoId(length: number): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const buffer = new Uint8Array(~~length);
  crypto.getRandomValues(buffer);

  return [...buffer]
    .map((idx) => charset.charAt(idx % charset.length))
    .join("");
}

export function makeDefaultIdGenerator(length = 16): ExchangeIdGenerator {
  return () => generateCryptoId(length);
}

export interface ReadableExchange {
  onCommand(): Promise<CommandSpec>;
  onReply(): Promise<CommandSpec>;
  onStream(): Promise<CommandSpec>;
  chunks(): AsyncGenerator<CommandSpec>;
}

export interface WritableExchange<T> {
  send(what: CommandSpec, to?: T): this;
  request(what: CommandSpec): this;
  reply(what: Omit<CommandSpec, "name">): void;
  fail(what: Omit<CommandSpec, "name">): void;
  stream(what: Omit<CommandSpec, "name" | "streamId">): void;
  finishStream(): void;

  canReply(): boolean;
  replyOrSend(what: CommandSpec): void;
  failOrSend(what: CommandSpec): void;
}

export interface Exchange<T> extends ReadableExchange, WritableExchange<T> {
  readonly source: T;
}

export class ReactorExchange<T> implements Exchange<T> {
  private commandResolvers: Array<(command: Command) => void> = [];
  private replyResolvers: Array<(command: Command) => void> = [];
  private replyRejectors: Array<(command: Command) => void> = [];
  private streamResolvers: Array<(command: Command) => void> = [];
  private queued: Array<Command> = [];

  private isOpen = true;

  constructor(
    public readonly source: T,
    private write: (what: CommandSpec, to: T) => void,
    private requestExchange: (
      what: CommandSpec,
      source: T,
    ) => ThisType<ReactorExchange<T>>,
    private free: () => void,
    private generateExchangeId: ExchangeIdGenerator = makeDefaultIdGenerator(),
    private command?: Command,
  ) {
    // Process originating command
    if (this.command) this.push(this.command);

    // Don't queue simple commands for promises
    if (this.command?.isSimple) this.queued = [];
  }

  push(what: Command): void {
    if (what.isSuccessResponse) {
      if (this.replyResolvers.length > 0)
        for (const resolve of this.replyResolvers) resolve(what);
      else this.queued.push(what);

      this.close();
    } else if (what.isErrorResponse) {
      if (this.replyRejectors.length > 0)
        for (const reject of this.replyRejectors) reject(what);
      else this.queued.push(what);

      this.close();
    } else if (what.isStreamChunk || what.isStreamEnd) {
      if (this.streamResolvers.length > 0) {
        for (const resolve of this.streamResolvers) resolve(what);
        this.streamResolvers = [];
      } else this.queued.push(what);

      if (what.isStreamEnd) this.close();
    } else {
      if (this.commandResolvers.length > 0) {
        for (const resolve of this.commandResolvers) resolve(what);
        this.commandResolvers = [];
      } else this.queued.push(what);
    }
  }

  send(what: CommandSpec, to?: T): this {
    this.write(what, to ?? this.source);
    return this.requestExchange(what, to ?? this.source) as this;
  }

  request(what: CommandSpec): this {
    const req: CommandSpec = {
      ...what,
      isRequest: true,
      requestId: this.generateExchangeId(),
    };

    return this.send(req);
  }

  canReply(): boolean {
    return this.command?.id !== undefined;
  }

  reply(what: Omit<CommandSpec, "name">): void {
    this.requireRepliable();
    this.requireOpen();

    this.write(
      {
        ...what,
        name: "",
        requestId: this.command?.requireId(),
        isSuccessResponse: true,
      },
      this.source,
    );
    this.close();
  }

  replyOrSend(what: CommandSpec): void {
    if (this.canReply()) this.reply(what);
    else this.send(what);
  }

  fail(what: Omit<CommandSpec, "name">): void {
    this.requireRepliable();
    this.requireOpen();

    this.write(
      {
        ...what,
        name: "",
        requestId: this.command?.requireId(),
        isErrorResponse: true,
      },
      this.source,
    );
  }

  failOrSend(what: CommandSpec): void {
    if (this.canReply()) this.fail(what);
    else this.send(what);
  }

  stream(what: Omit<CommandSpec, "name" | "streamId">): void {
    this.requireRepliable();
    this.requireOpen();

    this.write(
      {
        ...what,
        name: "",
        streamId: this.command?.requireId(),
        isStreamChunk: true,
      },
      this.source,
    );
  }

  finishStream(): void {
    this.requireRepliable();
    this.requireOpen();

    this.write(
      {
        name: "",
        data: "",
        streamId: this.command?.requireId(),
        isStreamEnd: true,
      },
      this.source,
    );
    this.close();
  }

  onCommand(): Promise<CommandSpec> {
    const queued = this.queued.find(
      (cmd) =>
        !cmd.isRequest &&
        !cmd.isSuccessResponse &&
        !cmd.isErrorResponse &&
        !cmd.isStreamChunk &&
        !cmd.isStreamEnd,
    );
    this.queued = this.queued.filter((cmd) => cmd !== queued);

    if (queued) return Promise.resolve(queued);

    this.requireOpen();
    return new Promise((resolve) => {
      this.commandResolvers.push(resolve);
    });
  }

  onReply(): Promise<CommandSpec> {
    const queued = this.queued.find(
      (cmd) => cmd.isSuccessResponse || cmd.isErrorResponse,
    );
    this.queued = this.queued.filter((cmd) => cmd !== queued);

    if (queued?.isSuccessResponse === true) return Promise.resolve(queued);
    if (queued?.isErrorResponse === true) return Promise.reject(queued);

    this.requireOpen();
    return new Promise((resolve, reject) => {
      this.replyResolvers.push(resolve);
      this.replyRejectors.push(reject);
    });
  }

  onStream(): Promise<CommandSpec> {
    const queued = this.queued.find(
      (cmd) => cmd.isStreamChunk || cmd.isStreamEnd || cmd.isErrorResponse,
    );
    this.queued = this.queued.filter((cmd) => cmd !== queued);

    if (queued?.isErrorResponse === true) return Promise.reject(queued);
    if (queued) return Promise.resolve(queued);

    this.requireOpen();

    return new Promise((resolve, reject) => {
      this.streamResolvers.push(resolve);
      this.replyRejectors.push(reject);
    });
  }

  async *chunks(): AsyncGenerator<CommandSpec> {
    while (true) {
      const chunk = await this.onStream();
      if (chunk.isStreamEnd) break;

      yield chunk;
    }
  }

  private requireRepliable() {
    assert(this.canReply(), "No replies can be sent to this command!");
  }

  private requireOpen() {
    assert(this.isOpen, "Exchange is already closed!");
  }

  private clearPromises(): void {
    this.replyResolvers = [];
    this.replyRejectors = [];
    this.streamResolvers = [];
  }

  private close(): void {
    this.clearPromises();
    this.free();
    this.isOpen = false;
  }
}

export abstract class Reactor<T> {
  private handlers: Map<string, CommandHandler<T>> = new Map();
  private defaultHandler: CommandHandler<T> = () => {};
  private errorHandler: CommandErrorHandler<T> = () => {};

  private exchanges: Map<string, ReactorExchange<T>> = new Map();

  constructor(
    private trimsock: Trimsock = new Trimsock().withConventions(),
    private generateExchangeId: ExchangeIdGenerator = makeDefaultIdGenerator(),
  ) {}

  public on(commandName: string, handler: CommandHandler<T>): this {
    this.handlers.set(commandName, handler);
    return this;
  }

  public onUnknown(handler: CommandHandler<T>): this {
    this.defaultHandler = handler;
    return this;
  }

  public onError(handler: CommandErrorHandler<T>): this {
    this.errorHandler = handler;
    return this;
  }

  public configure(callback: (reactor: this) => void): this {
    callback(this)
    return this
  }

  public ingest(data: Buffer, source: T): void {
    for (const item of this.trimsock.ingest(data)) {
      try {
        if (isCommand(item))
          this.handle(new Command(item as CommandSpec), source);
      } catch (err) {
        console.log(err);
        throw err;
      }
    }
  }

  public send(target: T, spec: CommandSpec): Exchange<T> {
    const command = new Command(spec);
    this.write(command.serialize(), target);
    return this.ensureExchange(command, target);
  }

  protected abstract write(data: string, target: T): void;

  private handle(command: Command, source: T) {
    const exchangeId = command.id;

    if (this.isNewExchange(command)) {
      const handler = this.handlers.get(command.name);
      const exchange = this.ensureExchange(command, source);

      try {
        if (handler) handler(command, exchange);
        else this.defaultHandler(command, exchange);
      } catch (error) {
        this.errorHandler(command, exchange, error);
      }
    } else {
      const exchange =
        exchangeId !== undefined && this.exchanges.get(exchangeId);
      assert(exchange, `Unknown exchange id: ${exchangeId}!`);
      exchange.push(command);
    }
  }

  private isNewExchange(command: Command): boolean {
    const exchangeId = command.id;
    const hasExchangeId = exchangeId !== undefined;
    const knownExchange = hasExchangeId && this.exchanges.get(exchangeId);

    // Request-response
    if (command.isRequest) {
      assert(hasExchangeId, "Request command is missing its request id!");
      return true;
    }
    if (command.isSuccessResponse || command.isErrorResponse) {
      assert(hasExchangeId, "Response command is missing its request id!");
      return false;
    }

    // Streams
    if (command.isStreamChunk) {
      assert(hasExchangeId, "Stream chunk command is missing its request id!");
      return knownExchange === undefined;
    }
    if (command.isStreamEnd) {
      assert(hasExchangeId, "Stream chunk command is missing its request id!");
      return false;
    }

    // Regular commands
    return true;
  }

  private findExchange(command: Command): ReactorExchange<T> | undefined {
    const id = command.requestId ?? command.streamId;
    return id !== undefined ? this.exchanges.get(id) : undefined;
  }

  private ensureExchange(command: Command, source: T): ReactorExchange<T> {
    const id = command.requestId ?? command.streamId;

    if (id === undefined) return this.makeExchange(command, source);

    const exchange =
      this.findExchange(command) ?? this.makeExchange(command, source);
    this.exchanges.set(id, exchange);
    return exchange;
  }

  private makeExchange(
    command: Command | undefined,
    source: T,
  ): ReactorExchange<T> {
    return new ReactorExchange(
      source,
      (cmd, to) => this.write(Command.serialize(cmd), to),
      (cmd, to) => this.ensureExchange(new Command(cmd), to),
      () => {
        const exchangeId = command?.requestId ?? command?.streamId;
        if (exchangeId !== undefined) this.exchanges.delete(exchangeId);
      },
      this.generateExchangeId,
      command,
    );
  }
}
