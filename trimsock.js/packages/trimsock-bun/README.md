# @foxssake/trimsock-bun

Provides support for using [trimsock-js] with [Bun].

## Features

- 🔃 TCP Socket support

## Usage

Install trimsock-js, using the command appropriate for your environment:

```sh
npm install @foxssake/trimsock-js
pnpm add @foxssake/trimsock-js
yarn add @foxssake/trimsock-js
bun add @foxssake/trimsock-js
```

Install the package:

```sh
npm install @foxssake/trimsock-bun
pnpm add @foxssake/trimsock-bun
yarn add @foxssake/trimsock-bun
bun add @foxssake/trimsock-bun
```

Implement a server:

```ts
import { BunSocketReactor } from "@foxssake/trimsock-bun";

new BunSocketReactor()
  .on("echo", (cmd, exchange) => exchange.replyOrSend(cmd))
  .onError((cmd, exchange, error) => console.error("Error occured processing command:", error))
  .listen({
    hostname: "localhost",
    port: 8890,
    socket: {
      open(socket) {
        // Event handlers are supported as well
        console.log("New connection!")
      }
    }
  })
```

## License

This package is under the [MIT License].


[trimsock-js]: ../trimsock-js/
[Bun]: https://bun.com/
[MIT License]: ./LICENSE
