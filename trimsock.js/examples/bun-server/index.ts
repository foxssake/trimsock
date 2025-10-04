import assert from "node:assert";
import { BunSocketReactor } from "@foxssake/trimsock-bun";
import { Command, makeDefaultIdGenerator } from "@foxssake/trimsock-js";
import type { Socket } from "bun";

type SocketContext = { sessionId: string };
const sockets: Set<Socket<SocketContext>> = new Set();

const generateSessionId = makeDefaultIdGenerator(4);

const reactor = new BunSocketReactor<SocketContext>()
  .on("echo", (cmd, exchange) => exchange.send(cmd))
  .on("info", (_, exchange) =>
    exchange.reply({
      text: "trimsock reactor",
    }),
  )
  .on("askme", async (_, exchange) => {
    console.log("Asking for a number from ", exchange.source.data.sessionId);
    const result = await exchange
      .request({
        name: "answer",
        text: "Give me a number pls",
      })
      .onReply();
    console.log("Response is ", result.text);
  })
  .on("stream", async (_, exchange) => {
    console.log("Started stream");
    for await (const chunk of exchange.chunks())
      console.log("Chunk", chunk.text, chunk.raw);
    console.log("Finished stream");
  })
  .on("proxy", (cmd, exchange) => {
    cmd.requireParams(2);
    const peerId = cmd.requireParam(0);
    const text = cmd.requireParam(1);

    const target = sockets.values().find((it) => it.data.sessionId === peerId);
    assert(target, `Unknown peer: ${peerId}`);

    exchange.send({ name: "proxy-data", text }, target);
  })
  .on("sessions", (_, exchange) => {
    for (const socket of sockets)
      exchange.stream({ text: socket.data.sessionId });
    exchange.finishStream();
  })
  .onUnknown((cmd, exchange) =>
    exchange.failOrSend({
      name: cmd.name,
      text: `Unknown command: ${cmd.name}`,
    }),
  )
  .onError((cmd, exchange, error) => {
    const message = (error as Error).message ?? error;
    exchange.failOrSend({
      name: cmd.name,
      text: `Failed to process command: ${Command.serialize(cmd)}\nError: ${message}`,
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
          text: sessionId,
        })
        .send({
          name: "stats",
          text: `Active connections: ${sockets.size}`,
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
