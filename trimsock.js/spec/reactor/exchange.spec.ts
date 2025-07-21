import { describe, expect, test } from "bun:test";
import { Command } from "@lib/command";
import { TestingExchange } from "./testing.exchange";

describe("Exchange", () => {
  describe("ReadableExchange", () => {
    describe("onReply", () => {
      test.todo("should return response", () => {});
      test.todo("should throw on fail", () => {});
      test.todo("should throw if already closed", () => {});
    });

    describe("onStream", () => {
      test.todo("should return chunk", () => {});
      test.todo("should return end", () => {});
      test.todo("should throw on fail", () => {});
      test.todo("should throw if already closed", () => {});
    });

    describe("chunks", () => {
      test.todo("should return chunks", () => {});
      test.todo("should return remaining chunks", () => {});
      test.todo("should throw on fail", () => {});
      test.todo("should throw if already closed", () => {});
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
