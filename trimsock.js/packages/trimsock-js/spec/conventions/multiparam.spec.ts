import { describe, expect, test } from "bun:test";
import type { CommandSpec } from "@lib/command.js";
import { TrimsockReader } from "@lib/reader.js";

type Kase = [string, string, CommandSpec]

describe("MultiparamConvention", () => tests([
  ["should passthrough raw command", "\rcommand 4\n1234\n", { name: "command", raw: Buffer.from("1234") }],
  ["should parse multiple params", "command foo bar\n", { name: "command", text: "foo bar", chunks: [{ text: "foo bar", isQuoted: false}], params: ["foo", "bar"]}],
  ["should retain quoted", "command foo \"quix bar\" baz\n", { name: "command", text: "foo quix bar baz", chunks: [{ text: "foo ", isQuoted: false}, { text: "quix bar", isQuoted: true}, { text: " baz", isQuoted: false }], params: ["foo", "quix bar", "baz"]}]
]))

function tests(kases: Kase[]) {
  kases.forEach(([name, input, expected]) => {
    test(name, () => {
      const reader = new TrimsockReader();
      reader.ingest(input)
      
      expect(reader.read()).toEqual(expected)
    })
  })
}
