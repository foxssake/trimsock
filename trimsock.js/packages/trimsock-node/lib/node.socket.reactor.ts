import * as net from "node:net";
import { Reactor } from "@foxssake/trimsock-js";

export class NodeSocketReactor extends Reactor<net.Socket> {
  public serve(
    options?: net.ServerOpts,
    connectionListener?: (socket: net.Socket) => void,
  ): net.Server {
    return net
      .createServer(options, connectionListener)
      .on("connection", (socket: net.Socket) => {
        socket.on("data", (data: Buffer) => this.ingest(data, socket));
      });
  }

  public connect(
    options: net.NetConnectOpts,
    connectionListener?: () => void,
  ): net.Socket {
    const socket = net.createConnection(options, connectionListener);
    socket.on("data", (data: Buffer) => this.ingest(data, socket));

    return socket;
  }

  protected write(data: string, target: net.Socket): void {
    // TODO: Better error handling
    target.write(data, (err?) => {
      err && console.error(err);
    });
  }
}
