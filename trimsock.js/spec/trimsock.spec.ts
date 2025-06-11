import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("Trimsock", () => {
  describe("ingest()", () => {
    describe("well-formed commands", () => {
      test("should parse command with data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data\n", "ascii");
        const expected = [
          { name: "command", data: Buffer.from("data", "ascii") },
        ];
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
        const input = Buffer.from("command foo\x00\n", "ascii");
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

      test("should unescape command name", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("co\\smm\\nand data\n", "ascii");
        const expected = [
          { name: "co mm\nand", data: Buffer.from("data", "ascii") },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });

      test("should unescape command data", () => {
        const trimsock = new Trimsock();
        const input = Buffer.from("command data \\n\\s\n", "ascii");
        const expected = [
          { name: "command", data: Buffer.from("data \n ", "ascii") },
        ];
        expect(trimsock.ingest(input)).toEqual(expected);
      });
    })

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
          [{ error: "Command length is above the allowed 6 bytes!" }],
          [],
          [{ name: "cmd", data: Buffer.of() }],
        ]);
      })

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
          [{ error: "Command length is above the allowed 10 bytes!" }],
          [{ name: "cmd", data: Buffer.of() }],
        ]);
      })
    })
  });

  describe("asString()", () => {
    const kases = [
      ["should stringify", "command", "data", "command data\n"],
      [
        "should escape newline in data",
        "command",
        "da\nta",
        "command da\\nta\n",
      ],
      [
        "should escape newline in name",
        "com\nmand",
        "data",
        "com\\nmand data\n",
      ],
      ["should escape space in name", "comm and", "data", "comm\\sand data\n"],
    ];

    for (const kase of kases) {
      const [name, commandName, commandData, expected] = kase;
      test(name, () => {
        const trimsock = new Trimsock();
        const command = {
          name: commandName,
          data: Buffer.from(commandData, "ascii"),
        };

        expect(trimsock.asString(command)).toBe(expected);
      });
    }
  });
});
