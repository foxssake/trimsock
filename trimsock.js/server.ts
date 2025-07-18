import assert from "node:assert";
import { serialize } from "@lib/command";
import { SocketReactor } from "@lib/reactor";
import type { Socket } from "bun";

type SocketContext = { sessionId: string };
const sockets: Set<Socket<SocketContext>> = new Set();

function generateSessionId(length = 4): string {
  const charset = "abcdefghijklmnopqrstuvwxyz";

  const buffer = new Uint8Array(~~length);
  crypto.getRandomValues(buffer);

  return [...buffer]
    .map((idx) => charset.charAt(idx % charset.length))
    .join("");
}

const reactor = new SocketReactor<SocketContext>()
  .on("echo", (cmd, exchange) => exchange.send(cmd))
  .on("info", (_, exchange) =>
    exchange.reply({
      data: Buffer.from("trimsock reactor", "ascii"),
    }),
  )
  .on("askme", async (_, exchange) => {
    console.log("Asking for a number from ", exchange.source.data.sessionId);
    const result = await exchange
      .request({
        name: "answer",
        data: Buffer.from("Give me a number pls", "ascii"),
      })
      .onReply();
    console.log("Response is ", result.data.toString("ascii"));
  })
  .on("stream", async (_, exchange) => {
    console.log("Started stream");
    for await (const chunk of exchange.chunks())
      console.log("Chunk", chunk.data.toString("ascii"), chunk.data);
    console.log("Finished stream");
  })
  .on("proxy", (cmd, exchange) => {
    assert(cmd.params && cmd.params.length === 2, "Command needs two params!");
    const peerId = cmd.params[0];
    const data = cmd.params[1];

    const target = sockets.values().find((it) => it.data.sessionId === peerId);
    assert(target, `Unknown peer: ${peerId}`);

    exchange.send(
      { name: "proxy-data", data: Buffer.from(data, "ascii") },
      target,
    );
  })
  .on("sessions", (_, exchange) => {
    for (const socket of sockets)
      exchange.reply({ data: Buffer.from(socket.data.sessionId, "ascii") });
  })
  .onUnknown((cmd, exchange) =>
    exchange.failOrSend({
      name: cmd.name,
      data: Buffer.from(`Unknown command: ${cmd.name}`, "ascii"),
    }),
  )
  .onError((cmd, exchange, error) => {
    const message = (error as Error).message ?? error;
    exchange.failOrSend({
      name: cmd.name,
      data: Buffer.from(
        `Failed to process command: ${serialize(cmd)}\nError: ${message}`,
        "ascii",
      ),
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
      reactor.send(socket, {
        name: "greet",
        data: Buffer.from(sessionId, "ascii"),
        isRaw: false,
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
