import type { Command } from "./command";

export interface Convention {
  process(command: Command): Command;
}

export class MultiparamConvention implements Convention {
  public process(command: Command): Command {
    if (!command.data.includes(" ")) return command;

    const text = command.data.toString("ascii");
    const params = text.split(" ").map((param) => param.replaceAll("\\s", " "));

    return { ...command, params };
  }
}

export class RequestResponseConvention implements Convention {
  public process(command: Command): Command {
    const name = command.name;
    if (!/[?\.!]/.test(name)) return command; // not a request / response

    if (name.includes("?"))
      return { ...command, ...this.parseName(name, "?"), isRequest: true };
    if (name.includes("."))
      return {
        ...command,
        ...this.parseName(name, "."),
        isSuccessResponse: true,
      };
    if (name.includes("!"))
      return {
        ...command,
        ...this.parseName(name, "!"),
        isErrorResponse: true,
      };

    return command;
  }

  private parseName(
    name: string,
    separator: string,
  ): { name: string; requestId: string } {
    const idx = name.indexOf(separator);
    const subname = name.substring(0, idx);
    const requestId = name.substring(idx + 1);

    return { name: subname, requestId };
  }
}
