import assert from "node:assert";
import type { SocketHandler } from "bun";
import { type Command, serialize } from "./command";
import { Trimsock, isCommand } from "./trimsock";

export type CommandHandler = (
  command: Command,
  response: TrimsockResponse,
) => void;

export type CommandErrorHandler = (
  command: Command,
  response: TrimsockResponse,
  error: unknown,
) => void;

export class TrimsockResponse {
  constructor(
    private write: (what: Command) => void,
    private command?: Command,
  ) {}

  send(what: Command): void {
    this.write(what);
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
    const handler = this.handlers.get(command.name);
    const response = new TrimsockResponse(
      (cmd) => this.write(serialize(cmd), source),
      command,
    );

    try {
      if (handler) handler(command, response);
      else this.defaultHandler(command, response);
    } catch (error) {
      this.errorHandler(command, response, error);
    }
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
