import type { CommandSpec } from "./command.js";

export interface Convention {
  process(command: CommandSpec): CommandSpec;
}

export class MultiparamConvention implements Convention {
  public process(command: CommandSpec): CommandSpec {
    if (command.data === undefined) return command;
    if (!command.data.includes(" ")) return command;

    const text = command.data;
    const params = text.split(" ").map((param) => param.replaceAll("\\s", " "));

    return { ...command, params };
  }
}

export class RequestResponseConvention implements Convention {
  public process(command: CommandSpec): CommandSpec {
    const name = command.name;
    if (!/[?\.!]/.test(name)) return command; // not a request / response

    if (name.includes("?"))
      return { ...command, ...parseName(name, "?"), isRequest: true };
    if (name.includes("."))
      return {
        ...command,
        ...parseName(name, "."),
        isSuccessResponse: true,
      };
    if (name.includes("!"))
      return {
        ...command,
        ...parseName(name, "!"),
        isErrorResponse: true,
      };

    return command;
  }
}

export class StreamConvention implements Convention {
  public process(command: CommandSpec): CommandSpec {
    const name = command.name;
    if (!name.includes("|")) return command; // not a stream command

    const parts = parseName(name, "|");
    // NOTE: Last `?? 0` should never run, command has either `data` or `raw`
    const dataSize = command.data?.length ?? command.raw?.byteLength ?? 0;

    return {
      ...command,
      name: parts.name,
      streamId: parts.requestId,
      isStreamChunk: dataSize > 0 ? true : undefined,
      isStreamEnd: dataSize <= 0 ? true : undefined,
    };
  }
}

function parseName(
  name: string,
  separator: string,
): { name: string; requestId: string } {
  const idx = name.indexOf(separator);
  const subname = name.substring(0, idx);
  const requestId = name.substring(idx + 1);

  return { name: subname, requestId };
}
