import type { SocketHandler } from "bun";
import type { Command } from "./command";
import { Trimsock, isCommand } from "./trimsock";

export type CommandHandler = (
  command: Command,
  response: TrimsockResponse,
) => void;

export interface TrimsockResponse {
  send(command: Command): void;
}

export abstract class Reactor<T> {
  private handlers: Map<string, CommandHandler> = new Map();

  constructor(private trimsock: Trimsock = new Trimsock().withConventions()) {}

  public on(commandName: string, handler: CommandHandler): this {
    this.handlers.set(commandName, handler);

    return this;
  }

  public ingest(data: Buffer, source: T) {
    for (const item of this.trimsock.ingest(data)) {
      if (isCommand(item)) this.handle(item as Command, source);
    }
  }

  public send(target: T, command: Command) {
    this.write(this.trimsock.asString(command), target);
  }

  protected abstract write(data: string, target: T): void;

  private handle(command: Command, source: T) {
    const handler = this.handlers.get(command.name);
    if (handler) {
      handler(command, {
        send: (cmd) => this.write(this.trimsock.asString(cmd), source),
      });
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
