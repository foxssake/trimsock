import assert from "node:assert";
import type { SocketHandler } from "bun";
import { type Command, getExchangeId, serialize } from "./command";
import { Trimsock, isCommand } from "./trimsock";

export type CommandHandler<T> = (
  command: Command,
  exchange: TrimsockExchange<T>,
) => void;

export type CommandErrorHandler<T> = (
  command: Command,
  exchange: TrimsockExchange<T>,
  error: unknown,
) => void;

function generateExchangeId(length: number): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const buffer = new Uint8Array(~~length);
  crypto.getRandomValues(buffer);

  return [...buffer]
    .map((idx) => charset.charAt(idx % charset.length))
    .join("");
}

export class TrimsockExchange<T> {
  private replyResolvers: Array<(command: Command) => void> = [];
  private replyRejectors: Array<(command: Command) => void> = [];
  private streamResolvers: Array<(command: Command) => void> = [];

  constructor(
    public readonly source: T,
    private write: (what: Command, to: T) => void,
    private requestExchange: (what: Command, source: T) => TrimsockExchange<T>,
    private close: () => void,
    private command?: Command,
  ) {}

  push(what: Command): void {
    if (what.isSuccessResponse) {
      for (const resolve of this.replyResolvers) resolve(what);
      this.clearPromises();
      this.close();
    } else if (what.isErrorResponse) {
      for (const reject of this.replyRejectors) reject(what);
      this.clearPromises();
      this.close();
    } else if (what.isStreamChunk || what.isStreamEnd) {
      for (const resolve of this.streamResolvers) resolve(what);
      this.streamResolvers = [];

      if (what.isStreamEnd) {
        this.clearPromises();
        this.close();
      }
    }
  }

  send(what: Command, to: T = this.source): TrimsockExchange<T> {
    this.write(what, to);
    return this.requestExchange(what, to);
  }

  request(what: Command): TrimsockExchange<T> {
    const req: Command = {
      ...what,
      isRequest: true,
      requestId: generateExchangeId(4),
    };

    return this.send(req);
  }

  canReply(): boolean {
    return this.command?.requestId !== undefined;
  }

  reply(what: Omit<Command, "name">): void {
    this.requireRequestId(this.command?.requestId);
    this.write(
      {
        ...what,
        name: "",
        requestId: this.command.requestId,
        isSuccessResponse: true,
      },
      this.source,
    );
    this.close();
  }

  replyOrSend(what: Command): void {
    if (this.canReply()) this.reply(what);
    else this.send(what);
  }

  fail(what: Omit<Command, "name">): void {
    this.requireRequestId(this.command?.requestId);
    this.write(
      {
        ...what,
        name: "",
        requestId: this.command.requestId,
        isErrorResponse: true,
      },
      this.source,
    );
  }

  failOrSend(what: Command): void {
    if (this.canReply()) this.fail(what);
    else this.send(what);
  }

  stream(what: Omit<Command, "name" | "streamId">): void {
    const exchangeId = getExchangeId(this.command)
    assert(exchangeId !== undefined, "Can't stream without a request or stream ID!")
    this.write(
      {
        ...what,
        name: "",
        streamId: exchangeId,
        isStreamChunk: true,
      },
      this.source,
    );
  }

  finishStream(): void {
    const exchangeId = getExchangeId(this.command)
    assert(exchangeId !== undefined, "Can't stream without a request or stream ID!")
    this.write(
      {
        name: "",
        data: Buffer.of(),
        streamId: exchangeId,
        isStreamEnd: true,
      },
      this.source,
    );
    this.close();
  }

  onReply(): Promise<Command> {
    // TODO: Test what happens if the exchange is already closed
    return new Promise((resolve, reject) => {
      this.replyResolvers.push(resolve);
      this.replyRejectors.push(reject);
    });
  }

  onStream(): Promise<Command> {
    // TODO: Test what happens if the exchange is already closed
    return new Promise((resolve, reject) => {
      this.streamResolvers.push(resolve);
      this.replyRejectors.push(reject);
    });
  }

  async *chunks(): AsyncGenerator<Command> {
    // TODO: Test what happens if `onStream()` has been called before
    if (this.command !== undefined) yield this.command;

    while (true) {
      const chunk = await this.onStream();
      if (chunk.isStreamEnd) break;

      yield chunk;
    }
  }

  private requireRequestId(requestId?: string): asserts requestId {
    assert(
      requestId !== undefined,
      "Can't reply if the command has no request id!",
    );
  }

  private clearPromises(): void {
    this.replyResolvers = [];
    this.replyRejectors = [];
    this.streamResolvers = [];
  }
}

export abstract class Reactor<T> {
  private handlers: Map<string, CommandHandler<T>> = new Map();
  private defaultHandler: CommandHandler<T> = () => {};
  private errorHandler: CommandErrorHandler<T> = () => {};

  private exchanges: Map<string, TrimsockExchange<T>> = new Map();

  constructor(private trimsock: Trimsock = new Trimsock().withConventions()) {}

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

  public ingest(data: Buffer, source: T) {
    for (const item of this.trimsock.ingest(data)) {
      try {
        if (isCommand(item)) this.handle(item as Command, source);
      } catch (err) {
        console.log(err);
        throw err;
      }
    }
  }

  public send(target: T, command: Command): TrimsockExchange<T> {
    this.write(serialize(command), target);
    return this.ensureExchange(command, target);
  }

  protected abstract write(data: string, target: T): void;

  private handle(command: Command, source: T) {
    const exchangeId = getExchangeId(command);

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
      const exchange = exchangeId && this.exchanges.get(exchangeId);
      assert(exchange, `Unknown exchange id: ${exchangeId}!`);
      exchange.push(command);
    }
  }

  private isNewExchange(command: Command): boolean {
    const exchangeId = getExchangeId(command);
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

  private findExchange(command: Command): TrimsockExchange<T> | undefined {
    const id = command.requestId ?? command.streamId;
    return id !== undefined ? this.exchanges.get(id) : undefined;
  }

  private ensureExchange(command: Command, source: T): TrimsockExchange<T> {
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
  ): TrimsockExchange<T> {
    return new TrimsockExchange(
      source,
      (cmd, to) => this.write(serialize(cmd), to),
      (cmd, to) => this.ensureExchange(cmd, to),
      () => {
        const exchangeId = command?.requestId ?? command?.streamId;
        if (exchangeId !== undefined) this.exchanges.delete(exchangeId);
      },
      command,
    );
  }
}

export class SocketReactor<SocketData = undefined> extends Reactor<
  Bun.Socket<SocketData>
> {
  public listen(
    options: Bun.TCPSocketListenOptions<SocketData>,
  ): Bun.TCPSocketListener<SocketData> {
    return Bun.listen({
      ...options,
      ...this.wrapHandlers(options),
    });
  }

  public connect(
    options: Bun.TCPSocketConnectOptions<SocketData>,
  ): Promise<Bun.Socket<SocketData>> {
    return Bun.connect({
      ...options,
      ...this.wrapHandlers(options),
    });
  }

  protected write(data: string, target: Bun.Socket<SocketData>): void {
    target.write(data);
  }

  private wrapHandlers(
    options: Bun.SocketOptions<SocketData>,
  ): Bun.SocketOptions<SocketData> {
    const baseHandlers: SocketHandler<SocketData> = options.socket ?? {};

    return {
      socket: {
        data: (socket, data) => {
          baseHandlers.data?.call(baseHandlers.data, socket, data);
          this.ingest(data, socket);
        },
        open: (socket) => {
          baseHandlers.open?.call(baseHandlers.open, socket);
        },
        close: (socket, error) => {
          baseHandlers.close?.call(baseHandlers.close, socket, error);
        },
        drain: (socket) => {
          baseHandlers.drain?.call(baseHandlers.drain, socket);
        },
        error: (socket, error) => {
          baseHandlers.error?.call(baseHandlers.error, socket, error);
        },
      },
    };
  }
}
