import type { Command } from "@lib/command";
import type { Convention } from "@lib/convention";

export class MultiparamConvention implements Convention {
  public process(command: Command): Command {
    const text = command.data.toString("ascii");
    const params = text.split(" ").map((param) => param.replaceAll("\\s", " "));

    return { ...command, params };
  }
}
