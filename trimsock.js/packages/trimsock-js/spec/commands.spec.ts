import { describe, expect, test } from "bun:test";
import { Command, type CommandSpec } from "@lib/command.js";

describe("Commands", () => {
  describe("serialize()", () => {
    const kases: Array<[string, CommandSpec, string]> = [
      ["should stringify", { name: "command", data: "data" }, "command data\n"],
      ["should optimize without data", { name: "command" }, "command\n"],
      ["should serialize empty", { name: "" }, "\n"],
      [
        "should escape newline in data",
        { name: "command", data: "da\nta" },
        "command da\\nta\n",
      ],
      [
        "should escape newline in name",
        { name: "com\nmand", data: "data" },
        "com\\nmand data\n",
      ],
      [
        "should escape space in name",
        { name: "comm and", data: "data" },
        "comm\\sand data\n",
      ],
      [
        "should escape \\r in name",
        { name: "\rcommand", data: "data" },
        "\\rcommand data\n",
      ],
      [
        "should serialize raw",
        { name: "command", raw: Buffer.from([102, 0, 111]) },
        "\rcommand 3\nf\x00o\n",
      ],
      [
        "should optimize empty raw",
        { name: "command", data: "" },
        "command\n",
      ],
      [
        "should keep spaces between params",
        { name: "command", data: "", params: ["foo", "ba ar"] },
        "command foo ba\\sar\n",
      ],
      [
        "should serialize stream chunk",
        {
          name: "command",
          streamId: "0123",
          isStreamChunk: true,
          data: "foo",
        },
        "command|0123 foo\n",
      ],
      [
        "should serialize stream chunk with empty id",
        {
          name: "command",
          streamId: "",
          isStreamChunk: true,
          data: "foo",
        },
        "command| foo\n",
      ],
      [
        "should serialize stream end",
        {
          name: "command",
          streamId: "0123",
          isStreamEnd: true,
          data: "",
        },
        "command|0123\n",
      ],
      [
        "should serialize request",
        {
          name: "command",
          requestId: "0123",
          isRequest: true,
          data: "foo",
        },
        "command?0123 foo\n",
      ],
      [
        "should serialize response",
        {
          name: "",
          requestId: "0123",
          isSuccessResponse: true,
          data: "bar",
        },
        ".0123 bar\n",
      ],
      [
        "should serialize error response",
        {
          name: "",
          requestId: "0123",
          isErrorResponse: true,
          data: "unknown command!",
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
