# @foxssake/trimsock-node

Provides support for using [trimsock-js] with [node.js].

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
npm install @foxssake/trimsock-node
pnpm add @foxssake/trimsock-node
yarn add @foxssake/trimsock-node
bun add @foxssake/trimsock-node
```

Implement a server:

```ts
import { NodeSocketReactor } from "@foxssake/trimsock-node";

const port = 8890
new NodeSocketReactor()
  .on("echo", (cmd, exchange) => exchange.replyOrSend(cmd))
  .onError((cmd, exchange, error) => console.error("Failed to process command:", command, error))
  .serve({}, (socket) => {
    // Custom event handlers are supported
    console.log("New connection!");
  })
  .listen(port, () => console.log("Listening on port", port));
```

## License

This package is under the [MIT License].


[trimsock-js]: ../trimsock-js/
[node.js]: https://nodejs.org/en
[MIT License]: ./LICENSE
