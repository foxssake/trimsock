import { Reactor } from "@foxssake/trimsock-js";
import type { SocketHandler } from "bun";

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
