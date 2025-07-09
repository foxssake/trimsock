import type { Command } from "./command";

export interface Convention {
  process(command: Command): Command;
}
