import { serialize } from "@lib/command";
import { SocketReactor } from "@lib/reactor";
import { randomUUIDv7 } from "bun";

type SocketContext = { sessionId: string };

const reactor = new SocketReactor<SocketContext>()
  .on("echo", (cmd, exchange) => exchange.send(cmd))
  .on("info", (_, exchange) =>
    exchange.reply({
      data: Buffer.from("trimsock reactor", "ascii"),
    }),
  )
  .on("askme", async (_, exchange) => {
    console.log("Asking for a number");
    const result = await exchange
      .request({
        name: "answer",
        data: Buffer.from("Give me a number pls", "ascii"),
      })
      .onReply();
    console.log("Response is ", result.data.toString("ascii"));
  })
  .on("stream", async (_, exchange) => {
    console.log("Started stream")
    for await (const chunk of exchange.chunks())
      console.log("Chunk", chunk.data.toString("ascii"), chunk.data)
    console.log("Finished stream")
  })
  .onUnknown((cmd, exchange) =>
    exchange.failOrSend({
      name: cmd.name,
      data: Buffer.from(`Unknown command: ${cmd.name}`, "ascii"),
    }),
  )
  .onError((cmd, exchange, error) =>
    exchange.failOrSend({
      name: cmd.name,
      data: Buffer.from(
        `Failed to process command: ${serialize(cmd)}\nError: ${error}`,
        "ascii",
      ),
    }),
  );

const port = 8890;
reactor.listen({
  hostname: "localhost",
  port,
  socket: {
    open(socket) {
      const sessionId = randomUUIDv7();
      socket.data = { sessionId };

      console.log("Created session ", sessionId);
      reactor.send(socket, {
        name: "greet",
        data: Buffer.from(sessionId, "ascii"),
        isRaw: false,
      });
    },
    close(socket, error) {
      const sessionId = socket.data.sessionId;
      console.log("Closed session ", sessionId, error);
    },
    error(socket, error) {
      const sessionId = socket.data.sessionId;
      console.error("Error in session ", sessionId, error);
    },
  },
});

console.log("Listening on port", port);
