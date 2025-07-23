import { describe, expect, test } from "bun:test";
import { Trimsock } from "@lib/trimsock";

describe("MultiparamConvention", () => {
  test("should passthrough raw data", () => {
    const trimsock = new Trimsock().withConventions();
    expect(
      trimsock.ingest(Buffer.from("\rcommand 4\nquix\n", "utf8")),
    ).toEqual([
      {
        name: "command",
        raw: Buffer.from("quix", "utf8"),
      },
    ]);
  });
  test("should parse multiple params", () => {
    const trimsock = new Trimsock().withConventions();
    expect(trimsock.ingest(Buffer.from("command foo bar\n", "utf8"))).toEqual([
      {
        name: "command",
        data: "foo bar",
        params: ["foo", "bar"],
      },
    ]);
  });
  test("should skip single param", () => {
    const trimsock = new Trimsock().withConventions();
    expect(trimsock.ingest(Buffer.from("command foo\n", "utf8"))).toEqual([
      {
        name: "command",
        data: "foo",
      },
    ]);
  });
  test("should unescape spaces", () => {
    const trimsock = new Trimsock().withConventions();
    expect(
      trimsock.ingest(Buffer.from("command foo bar\\squix\n", "utf8")),
    ).toEqual([
      {
        name: "command",
        data: "foo bar\\squix",
        params: ["foo", "bar quix"],
      },
    ]);
  });
});
