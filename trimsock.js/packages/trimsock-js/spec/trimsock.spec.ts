import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command.js";
import { Trimsock } from "@lib/trimsock.js";

describe("Trimsock", () => {
  describe("ingest()", () => {
    describe("well-formed commands", () => {
      test("should parse command with data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data\n", "utf8");
        const expected = [{ name: "command", data: "data" }];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse command without data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command \n", "utf8");
        const expected = [{ name: "command", data: "" }];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse command with binary data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command foo\x00\n", "utf8");
        const expected = [
          {
            name: "command",
            data: "foo\x00",
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse command in multiple chunks", () => {
        const trimsock = new Trimsock();
        const inputs = ["comma", "nd dat", "a\n"];

        const results = inputs
          .map((input) => Buffer.from(input, "utf8"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [
            {
              name: "command",
              data: "data",
            },
          ],
        ]);
      });

      test("should unescape command name", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("\\rco\\smm\\nand data\n", "utf8");
        const expected = [
          {
            name: "\rco mm\nand",
            data: "data",
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should unescape command data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data \\n\\s\n", "utf8");
        const expected = [
          {
            name: "command",
            data: "data \n\\s",
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse raw data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.concat([
          Buffer.from("\rcommand 4\n"),
          Buffer.from([10, 10, 10, 240]),
          Buffer.from("\n"),
        ]);
        const expected = [
          {
            name: "command",
            raw: Buffer.from([10, 10, 10, 240]),
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse raw data in chunks", () => {
        const trimsock = new Trimsock();
        const inputs = ["\rcomma", "nd 1", "0\n0123", "45678", "9\n"];

        const results = inputs
          .map((input) => Buffer.from(input, "utf8"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [],
          [],
          [
            {
              name: "command",
              raw: Buffer.from("0123456789", "utf8"),
            },
          ],
        ]);
      });

      test("should parse unicode", () => {
        const trimsock = new Trimsock();
        const expected: CommandSpec = {
          name: "commánd",
          data: "föő",
        };

        expect(trimsock.ingest(Buffer.from("commánd föő\n", "utf8"))).toEqual([
          expected,
        ]);
      });
    });

    describe("commands exceeding size limit", () => {
      test("should ignore if command name exceeds max size", () => {
        const trimsock = new Trimsock();
        trimsock.maxCommandSize = 6;
        const inputs = ["com", "mand ", "fo", "o\ncmd \n"];

        const results = inputs
          .map((input) => Buffer.from(input, "utf8"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [
            {
              error: "Expected command length 8 is above the allowed 6 bytes!",
            },
          ],
          [],
          [{ name: "cmd", data: "" }],
        ]);
      });

      test("should ignore if command data exceeds max size", () => {
        const trimsock = new Trimsock();
        trimsock.maxCommandSize = 10;
        const inputs = ["com", "mand ", "fo", "o\ncmd \n"];

        const results = inputs
          .map((input) => Buffer.from(input, "utf8"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [],
          [
            {
              error:
                "Expected command length 11 is above the allowed 10 bytes!",
            },
            { name: "cmd", data: "" },
          ],
        ]);
      });

      test("should ignore if raw command data exceeds max size", () => {
        const trimsock = new Trimsock();
        trimsock.maxCommandSize = 12;
        const inputs = [
          "\rcom",
          "mand ",
          "16",
          "\nfoo bar quix",
          " oof\ncmd \n",
        ];

        const results = inputs
          .map((input) => Buffer.from(input, "utf8"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [],
          [],
          [
            {
              error:
                "Expected command length 16 is above the allowed 12 bytes!",
            },
            { name: "cmd", data: "" },
          ],
        ]);
      });
    });
  });
});
