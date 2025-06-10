import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("Trimsock", () => {
  test("should parse command with data", () => {
    const trimsock = new Trimsock();
    const input = Buffer.from("command data\n", "ascii");
    const expected = [{ name: "command", data: Buffer.from("data", "ascii") }];
    expect(trimsock.ingest(input)).toEqual(expected);
  });

  test("should parse command without data", () => {
    const trimsock = new Trimsock();
    const input = Buffer.from("command \n", "ascii");
    const expected = [{ name: "command", data: Buffer.from("", "ascii") }];
    expect(trimsock.ingest(input)).toEqual(expected);
  });

  test("should parse command with binary data", () => {
    const trimsock = new Trimsock();
    const input = Buffer.from("command \b4\bfoo\x00\n", "ascii");
    const expected = [
      { name: "command", data: Buffer.from("foo\x00", "ascii") },
    ];
    expect(trimsock.ingest(input)).toEqual(expected);
  });

  test("should parse command in multiple chunks", () => {
    const trimsock = new Trimsock();
    const inputs = ["comma", "nd dat", "a\n"];

    const results = inputs
      .map((input) => Buffer.from(input, "ascii"))
      .map((input) => trimsock.ingest(input));

    expect(results).toEqual([
      [],
      [],
      [{ name: "command", data: Buffer.from("data", "ascii") }],
    ]);
  });

  test("should parse binary command in multiple chunks", () => {
    const trimsock = new Trimsock();
    const inputs = ["comma", "nd \b4", "\bf\x00", "ox\n"];

    const results = inputs
      .map((input) => Buffer.from(input, "ascii"))
      .map((input) => trimsock.ingest(input));

    expect(results).toEqual([
      [],
      [],
      [],
      [{ name: "command", data: Buffer.from("f\x00ox", "ascii") }],
    ]);
  });
});
