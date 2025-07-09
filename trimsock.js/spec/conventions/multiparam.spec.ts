import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("MultiparamConvention", () => {
  test("should passthrough raw data", () => {
    const trimsock = new Trimsock().withConventions();
    expect(
      trimsock.ingest(Buffer.from("\rcommand 4\nquix\n", "ascii")),
    ).toEqual([
      {
        name: "command",
        data: Buffer.from("quix", "ascii"),
        isRaw: true,
        params: ["quix"],
      },
    ]);
  });
  test("should parse multiple params", () => {
    const trimsock = new Trimsock().withConventions();
    expect(trimsock.ingest(Buffer.from("command foo bar\n", "ascii"))).toEqual([
      {
        name: "command",
        data: Buffer.from("foo bar", "ascii"),
        isRaw: false,
        params: ["foo", "bar"],
      },
    ]);
  });
  test("should parse single param", () => {
    const trimsock = new Trimsock().withConventions();
    expect(trimsock.ingest(Buffer.from("command foo\n", "ascii"))).toEqual([
      {
        name: "command",
        data: Buffer.from("foo", "ascii"),
        isRaw: false,
        params: ["foo"],
      },
    ]);
  });
  test("should unescape spaces", () => {
    const trimsock = new Trimsock().withConventions();
    expect(
      trimsock.ingest(Buffer.from("command foo bar\\squix\n", "ascii")),
    ).toEqual([
      {
        name: "command",
        data: Buffer.from("foo bar\\squix", "ascii"),
        isRaw: false,
        params: ["foo", "bar quix"],
      },
    ]);
  });
});
