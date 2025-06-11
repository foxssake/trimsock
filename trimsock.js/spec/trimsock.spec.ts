import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("Trimsock", () => {
  describe("ingest()", () => {
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

    test("should unescape command name", () => {
      const trimsock = new Trimsock();
      const input = Buffer.from("co\\smm\\nand\\b data\n", "ascii");
      const expected = [
        { name: "co mm\nand\b", data: Buffer.from("data", "ascii") },
      ];
      expect(trimsock.ingest(input)).toEqual(expected);
    });

    test("should unescape command data", () => {
      const trimsock = new Trimsock();
      const input = Buffer.from("command data \\n\\b\\s\n", "ascii");
      const expected = [
        { name: "command", data: Buffer.from("data \n\b ", "ascii") },
      ];
      expect(trimsock.ingest(input)).toEqual(expected);
    });
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
        "should escape backspace in data",
        "command",
        "da\bta",
        "command da\\bta\n",
      ],
      [
        "should escape newline in name",
        "com\nmand",
        "data",
        "com\\nmand data\n",
      ],
      [
        "should escape backspace in name",
        "comm\band",
        "data",
        "comm\\band data\n",
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

  describe("asBinary()", () => {
    const kases = [
      ["should serialize", "command", "f\x00x", "command \b3\bf\x00x\n"],
      [
        "should escape newline in name",
        "com\nmand",
        "f\x00x",
        "com\\nmand \b3\bf\x00x\n",
      ],
      [
        "should escape backspace in name",
        "comm\band",
        "f\x00x",
        "comm\\band \b3\bf\x00x\n",
      ],
      [
        "should escape space in name",
        "comm and",
        "f\x00x",
        "comm\\sand \b3\bf\x00x\n",
      ],
    ];

    for (const kase of kases) {
      const [name, commandName, commandData, expectedString] = kase;
      test(name, () => {
        const trimsock = new Trimsock();
        const command = {
          name: commandName,
          data: Buffer.from(commandData, "ascii"),
        };
        const expected = Buffer.from(expectedString, "ascii");

        expect(trimsock.asBinary(command)).toEqual(expected);
      });
    }
  });
});
