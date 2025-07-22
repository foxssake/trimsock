import { Command, type CommandSpec } from "@lib/command";
import { ReactorExchange } from "@lib/reactor";

export class TestingExchange extends ReactorExchange<string> {
  public outbox: Array<[string, CommandSpec]> = [];
  public inbox: Array<CommandSpec> = [];

  constructor(source = "", command?: Command) {
    super(
      source,
      (what, to) => {
        this.outbox ??= [];
        this.outbox.push([to, what]);
      },
      (what, source) => new TestingExchange(source, new Command(what)),
      () => {},
      command,
    );
  }

  push(what: Command): void {
    this.inbox ??= [];
    this.inbox.push(what);
    super.push(what);
  }
}
