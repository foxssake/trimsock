import { describe, expect, test } from "bun:test";
import { Command, type CommandSpec } from "@lib/command.js";

describe("Commands", () => {
  describe("serialize()", () => {
    const kases: Array<[string, CommandSpec, string]> = [
      [
        "should stringify",
        { name: "command", chunks: [{ text: "data", isQuoted: false }] },
        "command data\n",
      ],
      ["should optimize without data", { name: "command" }, "command\n"],
      ["should serialize empty", { name: "" }, "\n"],
      [
        "should escape newline in data",
        { name: "command", chunks: [{ text: "da\nta", isQuoted: false }] },
        "command da\\nta\n",
      ],
      [
        "should quote space in data",
        { name: "command", chunks: [{ text: "foo bar", isQuoted: false }] },
        'command "foo bar"\n',
      ],
      [
        "should escape newline in name",
        { name: "com\nmand", text: "data" },
        "com\\nmand data\n",
      ],
      [
        "should quote space in name",
        { name: "comm and", text: "data" },
        '"comm and" data\n',
      ],
      [
        "should escape \\r in name",
        { name: "\rcommand", text: "data" },
        "\\rcommand data\n",
      ],
      ["should retain quoted chunks", { name: "command", chunks: [{ text: "foo", isQuoted: true }]}, "command \"foo\"\n"],
      [
        "should serialize raw",
        { name: "command", raw: Buffer.from([102, 0, 111]) },
        "\rcommand 3\nf\x00o\n",
      ],
      ["should optimize empty", { name: "command", text: "" }, "command\n"],
      [
        "should keep spaces between params",
        { name: "command", text: "", params: ["foo", "ba ar"] },
        'command foo "ba ar"\n',
      ],
      [
        "should serialize stream chunk",
        {
          name: "command",
          streamId: "0123",
          isStreamChunk: true,
          text: "foo",
        },
        "command|0123 foo\n",
      ],
      [
        "should serialize stream chunk with empty id",
        {
          name: "command",
          streamId: "",
          isStreamChunk: true,
          text: "foo",
        },
        "command| foo\n",
      ],
      [
        "should serialize stream end",
        {
          name: "command",
          streamId: "0123",
          isStreamEnd: true,
          text: "",
        },
        "command|0123\n",
      ],
      [
        "should serialize request",
        {
          name: "command",
          requestId: "0123",
          isRequest: true,
          text: "foo",
        },
        "command?0123 foo\n",
      ],
      [
        "should serialize response",
        {
          name: "",
          requestId: "0123",
          isSuccessResponse: true,
          text: "bar",
        },
        ".0123 bar\n",
      ],
      [
        "should serialize error response",
        {
          name: "",
          requestId: "0123",
          isErrorResponse: true,
          text: "unknown command!",
        },
        '!0123 "unknown command!"\n',
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
