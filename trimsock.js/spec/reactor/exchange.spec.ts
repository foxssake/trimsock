import { describe, expect, test } from "bun:test";
import { Command, type CommandSpec } from "@lib/command";
import { TestingExchange } from "./testing.exchange";

describe("Exchange", () => {
  describe("ReadableExchange", () => {
    describe("onCommand", () => {
      test("should return command", async () => {
        const exchange = new TestingExchange("1", new Command({ name: "command", data: Buffer.of() }))
        exchange.push(new Command({ name: "else", data: Buffer.of() }))

        expect(await exchange.onCommand()).toEqual({ name: "else", data: Buffer.of() })
      })
      test("should throw if closed", async () => {})
    })
    describe("onReply", () => {
      test("should return response", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "command",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            data: Buffer.from("foo", "ascii"),
            requestId: "1234",
            isSuccessResponse: true,
          }),
        );
        expect(await exchange.onReply()).toEqual({
          name: "",
          data: Buffer.from("foo", "ascii"),
          requestId: "1234",
          isSuccessResponse: true,
        });
      });
      test("should throw after fail", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "command",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            data: Buffer.from("error", "ascii"),
            requestId: "1234",
            isErrorResponse: true,
          }),
        );
        expect(async () => await exchange.onReply()).toThrowError();
      });
      test("should throw if already closed", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "command",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );
        exchange.reply({ data: Buffer.from("bye", "ascii") });
        expect(async () => await exchange.onReply()).toThrow();
      });
    });

    describe("onStream", () => {
      test("should return chunk", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.onStream(); // Discard initial message

        exchange.push(
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        expect(await exchange.onStream()).toEqual({
          name: "stream",
          data: Buffer.from("foo", "ascii"),
          streamId: "1234",
          isStreamChunk: true,
        });
      });
      test("should return end", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.onStream(); // Discard initial message

        exchange.push(
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamEnd: true,
          }),
        );
        expect(await exchange.onStream()).toEqual({
          name: "stream",
          data: Buffer.of(),
          streamId: "1234",
          isStreamEnd: true,
        });
      });
      test("should return earlier chunk", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.push(
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );

        expect(await exchange.onStream()).toEqual({
          name: "stream",
          data: Buffer.of(),
          streamId: "1234",
          isStreamChunk: true,
        });
        expect(await exchange.onStream()).toEqual({
          name: "stream",
          data: Buffer.from("foo", "ascii"),
          streamId: "1234",
          isStreamChunk: true,
        });
      });
      test("should throw on fail", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.onStream(); // Discard initial message

        exchange
          .onStream()
          .then(() => expect().fail("Promise should not resolve!"))
          .catch(() => expect().pass("Error was thrown"));

        exchange.push(
          new Command({
            name: "stream",
            data: Buffer.from("error", "ascii"),
            requestId: "1234",
            isErrorResponse: true,
          }),
        );
      });
      test("should throw if already closed", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamEnd: true,
          }),
        );

        exchange
          .onStream()
          .then(() => expect().fail("Promise shouldn't resolve!"))
          .catch(() => expect().pass("Error was thrown"));
      });
    });

    describe("chunks", () => {
      test("should return chunks", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            data: Buffer.from("bar", "ascii"),
            isStreamChunk: true,
            streamId: "1234",
          }),
        );
        exchange.push(
          new Command({
            name: "",
            data: Buffer.of(),
            isStreamEnd: true,
            streamId: "1234",
          }),
        );

        expect(await Array.fromAsync(exchange.chunks())).toEqual([
          {
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          },
          {
            name: "",
            data: Buffer.from("bar", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          },
        ]);
      });

      test("should return remaining chunks", async () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            data: Buffer.from("bar", "ascii"),
            isStreamChunk: true,
            streamId: "1234",
          }),
        );
        exchange.push(
          new Command({
            name: "",
            data: Buffer.of(),
            isStreamEnd: true,
            streamId: "1234",
          }),
        );

        exchange.onStream();
        expect(await Array.fromAsync(exchange.chunks())).toEqual([
          {
            name: "",
            data: Buffer.from("bar", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          },
        ]);
      });
      test("should throw on fail", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            requestId: "1234",
            data: Buffer.of(),
            isErrorResponse: true,
          }),
        );

        Array.fromAsync(exchange.chunks())
          .then(() => expect().fail("Promise shouldn't resolve!"))
          .catch(() => expect().pass("Error was thrown"));
      });
      test("should throw if already closed", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );

        exchange.push(
          new Command({
            name: "",
            streamId: "1234",
            data: Buffer.of(),
            isStreamEnd: true,
          }),
        );

        Array.fromAsync(exchange.chunks())
          .then(() => expect().fail("Promise shouldn't resolve!"))
          .catch(() => expect().pass("Error was thrown"));
      });
    });
  });

  describe("WritableExchange", () => {
    describe("send", () => {
      test("should send data", () => {
        const exchange = new TestingExchange();
        exchange.send({ name: "command", data: Buffer.from("data", "ascii") });
        expect(exchange.outbox).toEqual([
          ["", { name: "command", data: Buffer.from("data", "ascii") }],
        ]);
      });
    });

    describe("request", () => {
      test("should send request with generated id", () => {
        const exchange = new TestingExchange();
        exchange.request({
          name: "command",
          data: Buffer.from("data", "ascii"),
        });

        const sent = exchange.outbox[0][1];
        expect(sent.name).toEqual("command");
        expect(sent.data).toEqual(Buffer.from("data", "ascii"));
        expect(sent.isRequest).toBeTrue();
        expect(sent.requestId).not.toBeNull();
      });
    });

    describe("reply", () => {
      test("should reply to request", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "request",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );
        exchange.reply({ data: Buffer.from("foo", "ascii") });

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              requestId: "1234",
              data: Buffer.from("foo", "ascii"),
              isSuccessResponse: true,
            },
          ],
        ]);
      });
      test("should reply to stream", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.reply({ data: Buffer.from("foo", "ascii") });

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              requestId: "1234",
              data: Buffer.from("foo", "ascii"),
              isSuccessResponse: true,
            },
          ],
        ]);
      });
      test("should throw without id", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({ name: "command", data: Buffer.of() }),
        );

        expect(() =>
          exchange.reply({ data: Buffer.from("foo", "ascii") }),
        ).toThrow();
      });
      test("should throw if closed", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.reply({ data: Buffer.from("foo", "ascii") });

        expect(() =>
          exchange.reply({ data: Buffer.from("bar", "ascii") }),
        ).toThrow();
      });
    });

    describe("fail", () => {
      test("should reply failure to request", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "request",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );
        exchange.fail({ data: Buffer.from("error", "ascii") });

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              requestId: "1234",
              data: Buffer.from("error", "ascii"),
              isErrorResponse: true,
            },
          ],
        ]);
      });
      test("should reply failure to stream", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "request",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.fail({ data: Buffer.from("error", "ascii") });

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              requestId: "1234",
              data: Buffer.from("error", "ascii"),
              isErrorResponse: true,
            },
          ],
        ]);
      });
      test("should throw without id", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({ name: "command", data: Buffer.of() }),
        );

        expect(() =>
          exchange.fail({ data: Buffer.from("error", "ascii") }),
        ).toThrow();
      });
      test("should throw if closed", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.reply({ data: Buffer.from("foo", "ascii") });

        expect(() =>
          exchange.fail({ data: Buffer.from("bar", "ascii") }),
        ).toThrow();
      });
    });

    describe("stream", () => {
      test("should stream with stream id", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.stream({ data: Buffer.from("foo", "ascii") });
        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              isStreamChunk: true,
              data: Buffer.from("foo", "ascii"),
              streamId: "1234",
            },
          ],
        ]);
      });
      test("should stream to request", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream-req",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );
        exchange.stream({ data: Buffer.from("foo", "ascii") });
        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              isStreamChunk: true,
              data: Buffer.from("foo", "ascii"),
              streamId: "1234",
            },
          ],
        ]);
      });
      test("should throw without id", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({ name: "stream", data: Buffer.of() }),
        );
        expect(() =>
          exchange.stream({ data: Buffer.from("foo", "ascii") }),
        ).toThrow();
      });
      test("should throw if closed", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.of(),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.finishStream();

        expect(() =>
          exchange.stream({ data: Buffer.from("foo", "ascii") }),
        ).toThrow();
      });
    });

    describe("finish stream", () => {
      test("should finish stream", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream",
            data: Buffer.from("foo", "ascii"),
            streamId: "1234",
            isStreamChunk: true,
          }),
        );
        exchange.finishStream();

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              streamId: "1234",
              data: Buffer.of(),
              isStreamEnd: true,
            },
          ],
        ]);
      });
      test("should finish to request", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({
            name: "stream-req",
            data: Buffer.of(),
            requestId: "1234",
            isRequest: true,
          }),
        );
        exchange.finishStream();

        expect(exchange.outbox).toEqual([
          [
            "1",
            {
              name: "",
              streamId: "1234",
              data: Buffer.of(),
              isStreamEnd: true,
            },
          ],
        ]);
      });
      test("should throw without id", () => {
        const exchange = new TestingExchange(
          "1",
          new Command({ name: "stream", data: Buffer.from("foo", "ascii") }),
        );
        expect(() => exchange.finishStream()).toThrow();
      });
    });
  });
});
