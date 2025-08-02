# @foxssake/trimsock-js

A reference implementation of the [trimsock protocol] for JavaScript and
TypeScript.

## Features

- 📦 Zero-dependency
- ✅ Parser implementing the full spec
- 🚀 Includes base classes for building applications

> [!NOTE]
> This package by itself doesn't handle any network communication. For that,
> try [trimsock-bun] or [trimsock-node].

## Usage

Install the package, using the command appropriate for your environment:

```sh
npm install @foxssake/trimsock-js
pnpm add @foxssake/trimsock-js
yarn add @foxssake/trimsock-js
bun add @foxssake/trimsock-js
```

Install an adapter for communication, for example [trimsock-bun]:

```sh
npm install @foxssake/trimsock-bun
pnpm add @foxssake/trimsock-bun
yarn add @foxssake/trimsock-bun
bun add @foxssake/trimsock-bun
```

Implement your server:

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


[trimsock protocol]: https://github.com/foxssake/trimsock
[trimsock-bun]: ../trimsock-bun
[trimsock-node]: https://github.com/foxssake/trimsock/tree/main/trimsock.js/packages/trimsock-node
[MIT License]: ./LICENSE

