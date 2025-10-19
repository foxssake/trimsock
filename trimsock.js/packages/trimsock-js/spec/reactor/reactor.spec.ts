import { beforeEach, describe, expect, mock, test } from "bun:test";
import { TestingReactor } from "./testing.reactor.js";

let reactor: TestingReactor<string>;

describe("Reactor", () => {
  beforeEach(() => {
    reactor = new TestingReactor();
  });

  describe("use()", () => {
    test("should call filters", () => {
      const firstFilter = mock((next) => {
        next();
      });
      const secondFilter = mock((next) => {
        next();
      });
      const handler = mock();

      reactor.use(firstFilter).use(secondFilter).on("command", handler);

      reactor.ingest("command test\n", "session");

      // Assert everything was called
      expect(firstFilter.mock.calls).not.toBeEmpty();
      expect(secondFilter.mock.calls).not.toBeEmpty();
      expect(handler.mock.calls).not.toBeEmpty();

      // Assert call order
      expect(firstFilter.mock.invocationCallOrder[0]).toBeLessThan(
        secondFilter.mock.invocationCallOrder[0],
      );
      expect(secondFilter.mock.invocationCallOrder[0]).toBeLessThan(
        handler.mock.invocationCallOrder[0],
      );
    });

    test("should break filter chain", () => {
      const firstFilter = mock((next) => {
        next();
      });
      const secondFilter = mock();
      const handler = mock();

      reactor.use(firstFilter).use(secondFilter).on("command", handler);

      reactor.ingest("command test\n", "session");

      // Assert everything was called
      expect(firstFilter.mock.calls).not.toBeEmpty();
      expect(secondFilter.mock.calls).not.toBeEmpty();
      expect(handler.mock.calls).toBeEmpty();

      // Assert call order
      expect(firstFilter.mock.invocationCallOrder[0]).toBeLessThan(
        secondFilter.mock.invocationCallOrder[0],
      );
    });

    test("should handle async", async () => {
      const firstFilter = mock(async (next) => {
        await Bun.sleep(0);
        next();
      });
      const secondFilter = mock(async (next) => {
        next();
      });
      const handler = mock(async () => await Bun.sleep(0));

      reactor.use(firstFilter).use(secondFilter).on("command", handler);

      reactor.ingest("command test\n", "session");
      await Bun.sleep(0);

      // Assert everything was called
      expect(firstFilter.mock.calls).not.toBeEmpty();
      expect(secondFilter.mock.calls).not.toBeEmpty();
      expect(handler.mock.calls).not.toBeEmpty();

      // Assert call order
      expect(firstFilter.mock.invocationCallOrder[0]).toBeLessThan(
        secondFilter.mock.invocationCallOrder[0],
      );
      expect(secondFilter.mock.invocationCallOrder[0]).toBeLessThan(
        handler.mock.invocationCallOrder[0],
      );
    });
  });
});
