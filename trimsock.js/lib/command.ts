export interface BaseCommand {
  name: string;
  data: Buffer;
  isRaw: boolean;
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

export interface Command extends BaseCommand, MultiparamCommand, RequestResponseCommand {}
