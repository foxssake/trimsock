import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command.js";
import { type ParserOutput, Trimsock } from "@lib/trimsock.js";

describe("StreamConvention", () => {
  test("should parse stream chunk", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "lobbies|0123 {foo}\n";
    const expected: CommandSpec = {
      name: "lobbies",
      data: "{foo}",
      streamId: "0123",
      isStreamChunk: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "utf8"))).toEqual([expected]);
  });
  test("should parse from parts", () => {
    const trimsock = new Trimsock().withConventions();
    const inputs = ["lobbies|01", "23 {fo", "o}\n"];
    const expected: Array<Array<ParserOutput>> = [
      [],
      [],
      [
        {
          name: "lobbies",
          data: "{foo}",
          streamId: "0123",
          isStreamChunk: true,
        },
      ],
    ];
    const actual = inputs.map((input) =>
      trimsock.ingest(Buffer.from(input, "utf8")),
    );

    expect(actual).toEqual(expected);
  });
  test("should parse stream end", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "|0123 \n";
    const expected: CommandSpec = {
      name: "",
      data: "",
      streamId: "0123",
      isStreamEnd: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "utf8"))).toEqual([expected]);
  });
  test("should passthrough params", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "lobbies|0123 name=foo players=5/7\n";
    const expected: CommandSpec = {
      name: "lobbies",
      data: "name=foo players=5/7",
      streamId: "0123",
      isStreamChunk: true,
      params: ["name=foo", "players=5/7"],
    };
    expect(trimsock.ingest(Buffer.from(input, "utf8"))).toEqual([expected]);
  });
  test("should passthrough raw", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "\rlobbies|0123 6\n\x03foo\x05\x07\n";
    const expected: CommandSpec = {
      name: "lobbies",
      raw: Buffer.from([3, 102, 111, 111, 5, 7]),
      streamId: "0123",
      isStreamChunk: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "utf8"))).toEqual([expected]);
  });
});
