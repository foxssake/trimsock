import { describe, expect, test } from "bun:test";
import { Command, type CommandSpec } from "@lib/command";

describe("Commands", () => {
  describe("serialize()", () => {
    const kases: Array<[string, CommandSpec, string]> = [
      [
        "should stringify",
        { name: "command", data: Buffer.from("data", "ascii") },
        "command data\n",
      ],
      [
        "should escape newline in data",
        { name: "command", data: Buffer.from("da\nta", "ascii") },
        "command da\\nta\n",
      ],
      [
        "should escape newline in name",
        { name: "com\nmand", data: Buffer.from("data", "ascii") },
        "com\\nmand data\n",
      ],
      [
        "should escape space in name",
        { name: "comm and", data: Buffer.from("data", "ascii") },
        "comm\\sand data\n",
      ],
      [
        "should escape \\r in name",
        { name: "\rcommand", data: Buffer.from("data", "ascii") },
        "\\rcommand data\n",
      ],
      [
        "should serialize raw",
        { name: "command", data: Buffer.from("f\x00o", "ascii"), isRaw: true },
        "\rcommand 3\nf\x00o\n",
      ],
      [
        "should optimize empty raw",
        { name: "command", data: Buffer.of(), isRaw: true },
        "command \n",
      ],
      [
        "should keep spaces between params",
        { name: "command", data: Buffer.of(), params: ["foo", "ba ar"] },
        "command foo ba\\sar\n",
      ],
      [
        "should serialize stream chunk",
        {
          name: "command",
          streamId: "0123",
          isStreamChunk: true,
          data: Buffer.from("foo", "ascii"),
        },
        "command|0123 foo\n",
      ],
      [
        "should serialize stream chunk with empty id",
        {
          name: "command",
          streamId: "",
          isStreamChunk: true,
          data: Buffer.from("foo", "ascii"),
        },
        "command| foo\n",
      ],
      [
        "should serialize stream end",
        {
          name: "command",
          streamId: "0123",
          isStreamEnd: true,
          data: Buffer.of(),
        },
        "command|0123 \n",
      ],
      [
        "should serialize request",
        {
          name: "command",
          requestId: "0123",
          isRequest: true,
          data: Buffer.from("foo", "ascii"),
        },
        "command?0123 foo\n",
      ],
      [
        "should serialize response",
        {
          name: "",
          requestId: "0123",
          isSuccessResponse: true,
          data: Buffer.from("bar", "ascii"),
        },
        ".0123 bar\n",
      ],
      [
        "should serialize error response",
        {
          name: "",
          requestId: "0123",
          isErrorResponse: true,
          data: Buffer.from("unknown command!", "ascii"),
        },
        "!0123 unknown\\scommand!\n",
      ],
    ];

    for (const kase of kases) {
      const [name, spec, expected] = kase;
      test(name, () => {
        expect(Command.serialize(spec)).toBe(expected);
      });
    }
  });
});
