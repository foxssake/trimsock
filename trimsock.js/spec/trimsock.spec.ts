import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("Trimsock", () => {
  describe("ingest()", () => {
    describe("well-formed commands", () => {
      test("should parse command with data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data\n", "ascii");
        const expected = [
          { name: "command", data: Buffer.from("data", "ascii"), isRaw: false },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse command without data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command \n", "ascii");
        const expected = [
          { name: "command", data: Buffer.from("", "ascii"), isRaw: false },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse command with binary data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command foo\x00\n", "ascii");
        const expected = [
          {
            name: "command",
            data: Buffer.from("foo\x00", "ascii"),
            isRaw: false,
          },
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
          [
            {
              name: "command",
              data: Buffer.from("data", "ascii"),
              isRaw: false,
            },
          ],
        ]);
      });

      test("should unescape command name", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("\\rco\\smm\\nand data\n", "ascii");
        const expected = [
          {
            name: "\rco mm\nand",
            data: Buffer.from("data", "ascii"),
            isRaw: false,
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should unescape command data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data \\n\\s\n", "ascii");
        const expected = [
          {
            name: "command",
            data: Buffer.from("data \n\\s", "ascii"),
            isRaw: false,
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse raw data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("\rcommand 4\n\n\n\n \n");
        const expected = [
          {
            name: "command",
            data: Buffer.from("\n\n\n ", "ascii"),
            isRaw: true,
          },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should parse raw data in chunks", () => {
        const trimsock = new Trimsock();
        const inputs = ["\rcomma", "nd 1", "0\n0123", "45678", "9\n"];

        const results = inputs
          .map((input) => Buffer.from(input, "ascii"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [],
          [],
          [
            {
              name: "command",
              data: Buffer.from("0123456789", "ascii"),
              isRaw: true,
            },
          ],
        ]);
      });
    });

    describe("commands exceeding size limit", () => {
      test("should ignore if command name exceeds max size", () => {
        const trimsock = new Trimsock();
        trimsock.maxCommandSize = 6;
        const inputs = ["com", "mand ", "fo", "o\ncmd \n"];

        const results = inputs
          .map((input) => Buffer.from(input, "ascii"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [
            {
              error: "Expected command length 9 is above the allowed 6 bytes!",
            },
          ],
          [],
          [{ name: "cmd", data: Buffer.of(), isRaw: false }],
        ]);
      });

      test("should ignore if command data exceeds max size", () => {
        const trimsock = new Trimsock();
        trimsock.maxCommandSize = 10;
        const inputs = ["com", "mand ", "fo", "o\ncmd \n"];

        const results = inputs
          .map((input) => Buffer.from(input, "ascii"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [
            {
              error:
                "Expected command length 11 is above the allowed 10 bytes!",
            },
          ],
          [{ name: "cmd", data: Buffer.of(), isRaw: false }],
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
          .map((input) => Buffer.from(input, "ascii"))
          .map((input) => trimsock.ingest(input));

        expect(results).toEqual([
          [],
          [],
          [],
          [
            {
              error:
                "Queued raw data of 16 bytes is larger than max command size of 12 bytes",
            },
          ],
          [{ name: "cmd", data: Buffer.of(), isRaw: false }],
        ]);
      });
    });
  });
});
