export interface BaseCommand {
  name: string;
  data: Buffer;
  isRaw?: boolean;
}

interface MultiparamCommand extends BaseCommand {
  params?: Array<string>;
}

interface RequestResponseCommand extends BaseCommand {
  requestId?: string;

  isRequest?: boolean;
  isSuccessResponse?: boolean;
  isErrorResponse?: boolean;
}

interface StreamCommand extends BaseCommand {
  streamId?: string;

  isStreamChunk?: boolean;
  isStreamEnd?: boolean;
}

export interface Command
  extends BaseCommand,
    MultiparamCommand,
    RequestResponseCommand,
    StreamCommand {}

export function serialize(command: Command): string {
  let name = "";

  // Figure out final command name
  if (command.streamId) name = `${command.name}|${command.streamId}`;
  else if (command.isRequest) name = `${command.name}?${command.requestId}`;
  else if (command.isSuccessResponse)
    name = `${command.name}.${command.requestId}`;
  else if (command.isErrorResponse)
    name = `${command.name}!${command.requestId}`;
  else name = command.name;

  name = escapeCommandName(name);

  // Early return for raw commands
  if (command.isRaw) 
    return (command.data.byteLength !== 0)
      ? `\r${name} ${command.data.byteLength}\n${command.data.toString("ascii")}\n`
      : `${name} \n`
  

  // Figure out data
  let data = "";
  if (command.params)
    data = command.params.map((it) => escapeCommandData(it)).join(" ");
  else data = escapeCommandData(command.data.toString("ascii"));

  return `${name} ${data}\n`;
}

export function escapeCommandName(name: string): string {
  return name
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll(" ", "\\s");
}

export function escapeCommandData(data: string): string {
  return data
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll(" ", "\\s");
}

export function unescapeCommandName(data: string): string {
  return data
    .replaceAll("\\s", " ")
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r");
}

export function unescapeCommandData(data: string): string {
  return data.replaceAll("\\n", "\n").replaceAll("\\r", "\r");
}
