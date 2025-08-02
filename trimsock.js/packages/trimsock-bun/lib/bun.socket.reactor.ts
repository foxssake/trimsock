import { Reactor } from "@foxssake/trimsock-js";
import type { SocketHandler } from "bun";

/**
 * Reactor adapter for [Bun's Socket API]
 *
 * It can be initialized either as a server using {@link listen | listen()}, or
 * or a client using {@link connect | connect()}.
 *
 * [Bun's Socket API]: https://bun.com/docs/api/tcp
 *
 * @see {@link Reactor}
 * @typeParam SocketData - custom data associated with each socket
 */
export class BunSocketReactor<SocketData = undefined> extends Reactor<
  Bun.Socket<SocketData>
> {
  /**
   * Start a server
   *
   * Creates a listening socket by calling [Bun.listen()]. Every new
   * connection will be read by the Reactor, to handle incoming commands.
   *
   * [Bun.listen()]: https://bun.com/docs/api/tcp#start-a-server-bun-listen
   *
   * @param options server options
   * @returns the created server
   */
  public listen(
    options: Bun.TCPSocketListenOptions<SocketData>,
  ): Bun.TCPSocketListener<SocketData> {
    return Bun.listen({
      ...options,
      ...this.wrapHandlers(options),
    });
  }

  /**
   * Connect to a peer
   *
   * Creates a socket and connects it by calling [Bun.connect()]. Incoming
   * commands will be parsed and handled by the Reactor.
   *
   * [Bun.connect()]: https://bun.com/docs/api/tcp#create-a-connection-bun-connect
   *
   * @param options connect options
   * @returns the created socket
   */
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
