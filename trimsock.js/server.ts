import { SocketReactor } from "@lib/reactor";
import { randomUUIDv7 } from "bun";

type SocketContext = { sessionId: string };

const reactor = new SocketReactor<SocketContext>()
  .on("echo", (cmd, response) => response.send(cmd))
  .on("info", (_, response) =>
    response.send({
      name: "info",
      data: Buffer.from("trimsock reactor", "ascii"),
      isRaw: false,
    }),
  );

reactor.listen({
  hostname: "localhost",
  port: 8890,
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

console.log("Listening");
