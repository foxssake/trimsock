import assert from "node:assert";
import { BunSocketReactor } from "@foxssake/trimsock-bun";
import { Command, makeDefaultIdGenerator } from "@foxssake/trimsock-js";
import type { Socket } from "bun";

type SocketContext = { sessionId: string };
const sockets: Set<Socket<SocketContext>> = new Set();

const generateSessionId = makeDefaultIdGenerator(4);

new BunSocketReactor()
  .on("echo", (cmd, exchange) => exchange.replyOrSend(cmd))
  .onError((cmd, exchange, error) => console.error("Error occured processing command:", error))
  .listen({
    hostname: "localhost",
    port: 8890,

  })

const reactor = new BunSocketReactor<SocketContext>()
  .on("echo", (cmd, exchange) => exchange.send(cmd))
  .on("info", (_, exchange) =>
    exchange.reply({
      data: "trimsock reactor",
    }),
  )
  .on("askme", async (_, exchange) => {
    console.log("Asking for a number from ", exchange.source.data.sessionId);
    const result = await exchange
      .request({
        name: "answer",
        data: "Give me a number pls",
      })
      .onReply();
    console.log("Response is ", result.data);
  })
  .on("stream", async (_, exchange) => {
    console.log("Started stream");
    for await (const chunk of exchange.chunks())
      console.log("Chunk", chunk.data, chunk.raw);
    console.log("Finished stream");
  })
  .on("proxy", (cmd, exchange) => {
    cmd.requireParams(2);
    const peerId = cmd.requireParam(0);
    const data = cmd.requireParam(1);

    const target = sockets.values().find((it) => it.data.sessionId === peerId);
    assert(target, `Unknown peer: ${peerId}`);

    exchange.send({ name: "proxy-data", data }, target);
  })
  .on("sessions", (_, exchange) => {
    for (const socket of sockets)
      exchange.stream({ data: socket.data.sessionId });
    exchange.finishStream();
  })
  .onUnknown((cmd, exchange) =>
    exchange.failOrSend({
      name: cmd.name,
      data: `Unknown command: ${cmd.name}`,
    }),
  )
  .onError((cmd, exchange, error) => {
    const message = (error as Error).message ?? error;
    exchange.failOrSend({
      name: cmd.name,
      data: `Failed to process command: ${Command.serialize(cmd)}\nError: ${message}`,
    });
  });

const port = 8890;
reactor.listen({
  hostname: "localhost",
  port,
  socket: {
    open(socket) {
      const sessionId = generateSessionId();
      socket.data = { sessionId };
      sockets.add(socket);

      console.log("Created session ", sessionId);
      reactor
        .send(socket, {
          name: "greet",
          data: sessionId,
        })
        .send({
          name: "stats",
          data: `Active connections: ${sockets.size}`,
        });
    },
    close(socket, error) {
      const sessionId = socket.data.sessionId;
      sockets.delete(socket);
      console.log("Closed session ", sessionId, error);
    },
    error(socket, error) {
      const sessionId = socket.data.sessionId;
      console.error("Error in session ", sessionId, error);
    },
  },
});

console.log("Listening on port", port);
