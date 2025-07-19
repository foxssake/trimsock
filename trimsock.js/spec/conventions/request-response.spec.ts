import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command";
import { Trimsock } from "@lib/trimsock";

describe("RequestResponseConvention", () => {
  test("should parse request", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "get-logo?0123 \n";
    const expected: CommandSpec = {
      name: "get-logo",
      data: Buffer.of(),
      isRaw: false,
      requestId: "0123",
      isRequest: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
  test("should parse response", () => {
    const trimsock = new Trimsock().withConventions();
    const input = ".0123 0xFD\n";
    const expected: CommandSpec = {
      name: "",
      data: Buffer.from("0xFD", "ascii"),
      isRaw: false,
      requestId: "0123",
      isSuccessResponse: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
  test("should parse error", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "!0123 not-found\n";
    const expected: CommandSpec = {
      name: "",
      data: Buffer.from("not-found", "ascii"),
      isRaw: false,
      requestId: "0123",
      isErrorResponse: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
  test("should passthrough params", () => {
    const trimsock = new Trimsock().withConventions();
    const input = ".0123 foo bar\n";
    const expected: CommandSpec = {
      name: "",
      data: Buffer.from("foo bar", "ascii"),
      isRaw: false,
      requestId: "0123",
      isSuccessResponse: true,
      params: ["foo", "bar"],
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
  test("should parse raw", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "\r.0123 4\n0xFD\n";
    const expected: CommandSpec = {
      name: "",
      data: Buffer.from("0xFD", "ascii"),
      isRaw: true,
      requestId: "0123",
      isSuccessResponse: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
});
