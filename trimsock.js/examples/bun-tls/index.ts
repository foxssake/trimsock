import { BunSocketReactor } from "@foxssake/trimsock-bun";

const reactor = new BunSocketReactor<void>()
  .on("echo", (cmd, xchg) => xchg.replyOrSend(cmd))
  .on("password", async (cmd, xchg) => xchg.replyOrSend({ name: "password", text: await Bun.password.hash(cmd.text ?? "") }));

const port = 8893;
reactor.listen({
  hostname: "localhost",
  port,
  socket: {
  },
  tls: {
    cert: Bun.file("./cert.pem"),
    key: Bun.file("./key.pem"),
    passphrase: "supersecret"
  }
});

console.log("Listening on port", port);
