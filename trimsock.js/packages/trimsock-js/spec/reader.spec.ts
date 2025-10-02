import type { CommandSpec } from "@lib/command.js";
import { TrimsockReader } from "@lib/reader.js";
import { describe, expect, test } from "bun:test";

type Kase = [string, string[] | string, CommandSpec[]];

describe("TrimsockReader", () => {
  const cases: Kase[] = [
    ["should parse simple name", "command \n", [{ name: "command", text: "", chunks: [] }]],
    ["should parse quoted name", "\"command name\" \n", [{ name: "command name", text: "", chunks: [] }]],

    ["should parse simple chunk", "command foo bar\n", [{ name: "command", text: "foo bar", chunks: [{ text: "foo bar", isQuoted: false }]}]],
    ["should parse quoted chunk", "command \"foo bar\"\n", [{ name: "command", text: "foo bar", chunks: [{ text: "foo bar", isQuoted: true}]}]],
    ["should parse mixed chunks", "command foo \"bar quix\" baz\n", [{ name: "command", text: "foo bar quix baz", chunks: [{ text: "foo ", isQuoted: false}, { text: "bar quix", isQuoted: true }, { text: " baz", isQuoted: false }]}]],

    ["should parse raw", "\rcommand 4\n1234\n", [{ name: "command", raw: Buffer.from("1234", "utf8")}]]
  ]

  cases.forEach(([name, input, expected]) => {
    const chunks = typeof input === "string" 
      ? [input]
      : [...input]

    test(name, () => {
      const reader = new TrimsockReader()
      const results: CommandSpec[] = []

      chunks.forEach(it => {
        reader.ingest(it)
        results.push(...reader.commands())
      })

      expect(results).toEqual(expected)
    })
  })
})
