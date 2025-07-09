export interface BaseCommand {
  name: string;
  data: Buffer;
  isRaw: boolean;
}

export interface MultiparamCommand extends BaseCommand {
  params?: Array<string>;
}

export interface Command extends BaseCommand, MultiparamCommand {};

