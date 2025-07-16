import assert from "node:assert";
import type { SocketHandler } from "bun";
import { type Command, serialize } from "./command";
import { Trimsock, isCommand } from "./trimsock";

export type CommandHandler = (
  command: Command,
  exchange: TrimsockExchange,
) => void;

export type CommandErrorHandler = (
  command: Command,
  exchange: TrimsockExchange,
  error: unknown,
) => void;

export class TrimsockExchange {
  private replyResolvers: Array<(command: Command) => void> = [];

  constructor(
    private write: (what: Command) => void,
    private requestExchange: (what: Command) => TrimsockExchange,
    private close: () => void,
    private command?: Command
  ) {}

  push(what: Command): void {
    if (what.isSuccessResponse) {
      for (const resolve of this.replyResolvers)
        resolve(what)
      this.replyResolvers = []
      this.close()
    }
  }

  send(what: Command): TrimsockExchange {
    this.write(what)
    return this.requestExchange(what)
  }

  request(what: Command): TrimsockExchange {
    const req: Command = {
      ...what,
      isRequest: true,
      requestId: "0123" // TODO: Randomgen
    }

    return this.send(req)
  }

  canReply(): boolean {
    return this.command?.requestId !== undefined;
  }

  reply(what: Omit<Command, "name">): void {
    this.requireRequestId(this.command?.requestId);
    this.write({
      ...what,
      name: "",
      requestId: this.command.requestId,
      isSuccessResponse: true,
    });
  }

  fail(what: Omit<Command, "name">): void {
    this.requireRequestId(this.command?.requestId);
    this.write({
      ...what,
      name: "",
      requestId: this.command.requestId,
      isErrorResponse: true,
    });
  }

  failOrSend(what: Command): void {
    if (this.canReply()) this.fail(what);
    else this.send(what);
  }

  onReply(): Promise<Command> {
    return new Promise(resolve => this.replyResolvers.push(resolve))
  }

  private requireRequestId(requestId?: string): asserts requestId {
    assert(
      requestId !== undefined,
      "Can't reply if the command has no request id!",
    );
  }
}

export abstract class Reactor<T> {
  private handlers: Map<string, CommandHandler> = new Map();
  private defaultHandler: CommandHandler = () => {};
  private errorHandler: CommandErrorHandler = () => {};

  private exchanges: Map<string, TrimsockExchange> = new Map();

  constructor(private trimsock: Trimsock = new Trimsock().withConventions()) {}

  public on(commandName: string, handler: CommandHandler): this {
    this.handlers.set(commandName, handler);
    return this;
  }

  public onUnknown(handler: CommandHandler): this {
    this.defaultHandler = handler;
    return this;
  }

  public onError(handler: CommandErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  public ingest(data: Buffer, source: T) {
    for (const item of this.trimsock.ingest(data)) {
      if (isCommand(item)) this.handle(item as Command, source);
    }
  }

  public send(target: T, command: Command) {
    this.write(serialize(command), target);
  }

  protected abstract write(data: string, target: T): void;

  private handle(command: Command, source: T) {
    // This is an ongoing exchange
    const exchangeId = command.requestId ?? command.streamId;
    if (exchangeId !== undefined && this.exchanges.has(exchangeId)) {
      const exchange = this.exchanges.get(exchangeId)!!
      exchange.push(command)
      return
    }

    // New exchange
    const handler = this.handlers.get(command.name);
    const exchange = this.ensureExchange(command, source);

    try {
      if (handler) handler(command, exchange);
      else this.defaultHandler(command, exchange);
    } catch (error) {
      this.errorHandler(command, exchange, error);
    }
  }

  private findExchange(command: Command): TrimsockExchange | undefined {
    const id = command.requestId ?? command.streamId;
    return id !== undefined ? this.exchanges.get(id) : undefined;
  }

  private ensureExchange(command: Command, source: T): TrimsockExchange {
    const id = command.requestId ?? command.streamId;

    if (id === undefined)
      return this.makeExchange(command, source)

    const exchange = this.findExchange(command) ?? this.makeExchange(command, source);
    this.exchanges.set(id, exchange)
    return exchange
  }

  private makeExchange(command: Command, source: T): TrimsockExchange {
    return new TrimsockExchange(
      (cmd) => this.write(serialize(cmd), source),
      (cmd) => this.ensureExchange(cmd, source),
      () => { if(command.requestId ?? command.streamId)
        this.exchanges.delete(command?.requestId ?? command?.streamId!!)
      },
      command
    )
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
