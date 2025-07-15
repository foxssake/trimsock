import { Reactor } from "@lib/reactor";
import { randomUUIDv7 } from "bun";

const sessionIds: Map<Bun.Socket, string> = new Map();

const reactor = new Reactor()
  .on('echo', (cmd, response) => response.send(cmd))
  .on('info', (cmd, response) => response.send({ name: 'info', data: Buffer.from('trimsock reactor', 'ascii'), isRaw: false }))

Bun.listen({
  hostname: "localhost",
  port: 8890,
  socket: {
    data(socket, data) {
      reactor.ingest(data, output => socket.write(output))
    }, 
    open(socket) {
      const sessionId = randomUUIDv7();
      sessionIds.set(socket, sessionId);

      console.log("Created session ", sessionId);
    }, 
    close(socket, error) {
      const sessionId = sessionIds.get(socket)
      sessionIds.delete(socket)
      console.log("Closed session ", sessionId, error)
    }, 
    drain(socket) {}, 
    error(socket, error) {
      const sessionId = sessionIds.get(socket)
      console.error("Error in session ", sessionId, error)
    }, 
  }
})

console.log("Listening");
