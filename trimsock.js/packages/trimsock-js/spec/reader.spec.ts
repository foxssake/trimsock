import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command.js";
import {
  BufferOverflowError,
  ParserError,
  UnexpectedCharacterError,
} from "@lib/errors.js";
import { TrimsockReader } from "@lib/reader.js";

type Kase = [string, string[] | string, CommandSpec[]];

describe("TrimsockReader", () => {
  describe("name parsing", () =>
    tests([
      [
        "should parse simple name",
        "command \n",
        [{ name: "command", text: "", chunks: [] }],
      ],
      [
        "should parse quoted name",
        '"command name" \n',
        [{ name: "command name", text: "", chunks: [] }],
      ],
      [
        "should unescape simple name",
        'co\\n\\" \n',
        [{ name: 'co\n"', text: "", chunks: [] }],
      ],
      [
        "should unescape quoted name",
        '"\\"command\\"" \n',
        [{ name: '"command"', text: "", chunks: [] }],
      ],
    ]));

  describe("data chunks", () =>
    tests([
      [
        "should parse simple chunk",
        "command foo bar\n",
        [
          {
            name: "command",
            text: "foo bar",
            chunks: [{ text: "foo bar", isQuoted: false }],
          },
        ],
      ],
      [
        "should parse quoted chunk",
        'command "foo bar"\n',
        [
          {
            name: "command",
            text: "foo bar",
            chunks: [{ text: "foo bar", isQuoted: true }],
          },
        ],
      ],
      [
        "should parse mixed chunks",
        'command foo "bar quix" baz\n',
        [
          {
            name: "command",
            text: "foo bar quix baz",
            chunks: [
              { text: "foo ", isQuoted: false },
              { text: "bar quix", isQuoted: true },
              { text: " baz", isQuoted: false },
            ],
          },
        ],
      ],
      [
        "should unescape simple chunk",
        "command foo\\nbar\n",
        [
          {
            name: "command",
            text: "foo\nbar",
            chunks: [{ text: "foo\nbar", isQuoted: false }],
          },
        ],
      ],
      [
        "should unescape quoted chunk",
        'command "foo\\"bar"\n',
        [
          {
            name: "command",
            text: 'foo"bar',
            chunks: [{ text: 'foo"bar', isQuoted: true }],
          },
        ],
      ],
    ]));

  describe("technically well formed commands", () =>
    tests([
      [
        "should parse space command",
        " \n",
        [{ name: "", text: "", chunks: [] }],
      ],
      [
        "should parse empty command",
        "\n",
        [{ name: "", text: "", chunks: [] }],
      ],
      [
        "should parse name only command",
        "command\n",
        [{ name: "command", text: "", chunks: [] }],
      ],
    ]));

  describe("raw commands", () =>
    tests([
      [
        "should parse raw",
        "\rcommand 4\n1234\n",
        [{ name: "command", raw: Buffer.from("1234") }],
      ],
      [
        "should parse empty raw",
        "\rcommand 0\n\n",
        [{ name: "command", raw: Buffer.of() }],
      ],
    ]));

  describe("chunked commands", () =>
    tests([
      [
        "should parse command in chunks",
        ["comm", "and ", "data", "\n"],
        [
          {
            name: "command",
            text: "data",
            chunks: [{ text: "data", isQuoted: false }],
          },
        ],
      ],
      [
        "should parse quoted command name in chunks",
        ['"', "command", '" ', "data", "\n"],
        [
          {
            name: "command",
            text: "data",
            chunks: [{ text: "data", isQuoted: false }],
          },
        ],
      ],
      [
        "should parse quoted chunk in chunks",
        ["command ", '"', "foo bar", '"\n'],
        [
          {
            name: "command",
            text: "foo bar",
            chunks: [{ text: "foo bar", isQuoted: true }],
          },
        ],
      ],
      [
        "should parse raw command in chunks",
        ["\rcommand 1", "0\n", "0123", "456789\n"],
        [{ name: "command", raw: Buffer.from("0123456789") }],
      ],
      [
        "should parse raw command split at its terminator",
        ["\rcommand 4\n", "1234", "\ncommand after\n"],
        [
          { name: "command", raw: Buffer.from("1234") },
          {
            name: "command",
            text: "after",
            chunks: [{ text: "after", isQuoted: false }],
          },
        ],
      ],
      [
        "should parse regular and raw commands",
        ["command foo\n\rraw 4\n1234\ncommand bar\n"],
        [
          {
            name: "command",
            text: "foo",
            chunks: [{ text: "foo", isQuoted: false }],
          },
          { name: "raw", raw: Buffer.from("1234") },
          {
            name: "command",
            text: "bar",
            chunks: [{ text: "bar", isQuoted: false }],
          },
        ],
      ],
    ]));

  describe("unsatisfiable raw commands", () => {
    const kases: [string, string][] = [
      ["missing size", "\rcommand\n"],
      ["non-numeric size", "\rcommand foo\n"],
      ["blank line", "\r\n"],
      ["negative size", "\rcommand -4\n"],
      ["size over maxSize", "\rcommand 100000\n"],
      ["size just over maxSize", "\rcommand 16385\n"],
      // The terminating newline wouldn't fit in the buffer
      ["size at maxSize", "\rcommand 16384\n"],
    ];

    for (const [name, input] of kases)
      test(`should reject raw command with ${name}`, () => {
        const reader = new TrimsockReader();
        reader.ingest(input);

        expect(() => [...reader.commands()]).toThrow(ParserError);
      });

    test("should keep parsing after rejecting a raw command", () => {
      const reader = new TrimsockReader();

      reader.ingest("\r\n");
      expect(() => [...reader.commands()]).toThrow(ParserError);

      reader.ingest("command foo\n");
      expect([...reader.commands()].map((it) => it.name)).toEqual(["command"]);
    });

    test("should accept raw command sized up to maxSize", () => {
      const reader = new TrimsockReader();
      reader.maxSize = 16;

      // 15 bytes of data plus the terminating newline exactly fill the buffer
      reader.ingest("\rcommand 15\n");
      expect([...reader.commands()]).toBeEmpty();

      reader.ingest("012345678901234\n");
      expect([...reader.commands()]).toEqual([
        { name: "command", raw: Buffer.from("012345678901234") },
      ]);
    });
  });

  describe("raw data terminator", () => {
    test("should not emit a command for the terminator", () => {
      const reader = new TrimsockReader();

      reader.ingest("\rcommand 4\n");
      expect([...reader.commands()]).toBeEmpty();

      // The data arrives without its terminator
      reader.ingest("1234");
      expect([...reader.commands()]).toBeEmpty();

      reader.ingest("\n");
      expect([...reader.commands()]).toEqual([
        { name: "command", raw: Buffer.from("1234") },
      ]);
    });

    test("should reject raw data with a malformed terminator", () => {
      const reader = new TrimsockReader();
      reader.ingest("\rcommand 4\n1234X\n");

      expect(() => [...reader.commands()]).toThrow(UnexpectedCharacterError);
    });

    test("should keep parsing after a malformed terminator", () => {
      const reader = new TrimsockReader();

      // The malformed terminator is consumed in its place, so parsing resumes
      // on the next line
      reader.ingest("\rcommand 4\n1234Xcommand foo\n");
      expect(() => [...reader.commands()]).toThrow(UnexpectedCharacterError);

      expect([...reader.commands()].map((it) => it.name)).toEqual(["command"]);
    });
  });

  describe("buffer overflow", () => {
    test("should throw on buffer overflow", () => {
      const reader = new TrimsockReader();
      reader.maxSize = 8;

      expect(() => reader.ingest("command foobar\n")).toThrow(
        BufferOverflowError,
      );
    });

    test("should resume parsing after discarding the buffer", () => {
      const reader = new TrimsockReader();
      reader.maxSize = 16;

      reader.ingest("012345678901");
      expect([...reader.commands()]).toBeEmpty();

      expect(() => reader.ingest("01234")).toThrow(BufferOverflowError);

      reader.ingest("command\n");
      expect([...reader.commands()].map((it) => it.name)).toEqual(["command"]);
    });

    test("should reset quote state after discarding the buffer", () => {
      const reader = new TrimsockReader();
      reader.maxSize = 16;

      reader.ingest('"');
      expect([...reader.commands()]).toBeEmpty();

      expect(() => reader.ingest("0123456789012345")).toThrow(
        BufferOverflowError,
      );

      reader.ingest("command foo\n");
      expect([...reader.commands()].map((it) => it.name)).toEqual(["command"]);
    });

    test("should drop queued raw command after discarding the buffer", () => {
      const reader = new TrimsockReader();
      reader.maxSize = 16;

      reader.ingest("\rcommand 8\n");
      expect([...reader.commands()]).toBeEmpty();

      expect(() => reader.ingest("0".repeat(17))).toThrow(BufferOverflowError);

      reader.ingest("command foo\n");
      expect([...reader.commands()].map((it) => it.name)).toEqual(["command"]);
    });
  });
});

function tests(kases: Kase[]) {
  for (const [name, input, expected] of kases) {
    const chunks = typeof input === "string" ? [input] : [...input];

    test(name, () => {
      const reader = new TrimsockReader();
      const results: CommandSpec[] = [];

      reader.disableConventions();
      for (const chunk of chunks) {
        reader.ingest(chunk);
        results.push(...reader.commands());
      }

      expect(results).toEqual(expected);
    });
  }
}
