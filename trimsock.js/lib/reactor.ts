import type { Command } from "./command";
import { isCommand, Trimsock } from "./trimsock";

export type CommandHandler = (command: Command, response: TrimsockResponse) => void;
export type OutputSink = (data: string) => void;

export interface TrimsockResponse {
  send(command: Command): void;
}

export class Reactor {
  private handlers: Map<string, CommandHandler> = new Map();

  constructor(
    private trimsock: Trimsock = new Trimsock().withConventions()
  ) {}

  public on(commandName: string, handler: CommandHandler): Reactor {
    this.handlers.set(commandName, handler);

    return this;
  }

  public ingest(data: Buffer, sink: OutputSink) {
    this.trimsock.ingest(data)
      .filter(it => isCommand(it))
      .forEach(command => this.handle(command as Command, sink));
  }

  private handle(command: Command, sink: OutputSink) {
    const handler = this.handlers.get(command.name);
    if (handler) {
      handler(command, {
        send: (cmd) => sink(this.trimsock.asString(cmd))
      });
    }
  }
}
