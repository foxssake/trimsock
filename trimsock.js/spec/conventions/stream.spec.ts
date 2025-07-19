import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command";
import { type ParserOutput, Trimsock } from "@lib/trimsock";

describe("StreamConvention", () => {
  test("should parse stream chunk", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "lobbies|0123 {foo}\n";
    const expected: CommandSpec = {
      name: "lobbies",
      data: Buffer.from("{foo}", "ascii"),
      isRaw: false,
      streamId: "0123",
      isStreamChunk: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
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
          data: Buffer.from("{foo}", "ascii"),
          isRaw: false,
          streamId: "0123",
          isStreamChunk: true,
        },
      ],
    ];
    const actual = inputs.map((input) =>
      trimsock.ingest(Buffer.from(input, "ascii")),
    );

    expect(actual).toEqual(expected);
  });
  test("should parse stream end", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "|0123 \n";
    const expected: CommandSpec = {
      name: "",
      data: Buffer.of(),
      isRaw: false,
      streamId: "0123",
      isStreamEnd: true,
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
  test("should passthrough params", () => {
    const trimsock = new Trimsock().withConventions();
    const input = "lobbies|0123 name=foo players=5/7\n";
    const expected: CommandSpec = {
      name: "lobbies",
      data: Buffer.from("name=foo players=5/7", "ascii"),
      isRaw: false,
      streamId: "0123",
      isStreamChunk: true,
      params: ["name=foo", "players=5/7"],
    };
    expect(trimsock.ingest(Buffer.from(input, "ascii"))).toEqual([expected]);
  });
});
