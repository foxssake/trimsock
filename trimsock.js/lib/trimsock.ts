export interface Command {
  name: string;
  data: Buffer;
}

export interface ParseError {
  error: string;
}

const BS = 0x08;
const NL = 0x0A;
const SP = 0x20;

export class Trimsock {
  private maxCommandSize: number = 16384;
  private messageBuffer: Buffer = Buffer.alloc(0);

  ingest(buffer: Buffer): Array<Command | ParseError> {
    const nlPos = buffer.indexOf(NL);
    const spPos = buffer.indexOf(SP);
    const bsPos = [buffer.indexOf(BS), buffer.indexOf(BS, buffer.indexOf(BS)+1)];

    if (nlPos < 0 || spPos < 0)
      return [];

    if (bsPos[0] >= 0) {
      if (bsPos[1] < 0)
        return [{ error: "Terminating BS missing" }]; // Terminating BS is missing

      const sizeString = buffer.toString("ascii", bsPos[0] + 1, bsPos[1])
      const size = parseInt(sizeString, 10);
      if (size < 0 || size > this.maxCommandSize || !isFinite(size)) 
        return [{ error: `Invalid size: ${sizeString} (${bsPos})`}]; // Invalid size

      return [{
        name: buffer.toString("ascii", 0, spPos),
        data: Buffer.copyBytesFrom(buffer, bsPos[1] + 1, size)
      }]
    }

    return [{
      name: buffer.toString("ascii", 0, spPos),
      data: Buffer.copyBytesFrom(buffer, spPos + 1, (nlPos - spPos) - 1)
    }];
  }

  asString(command: Command): string {
    return ""; // TODO
  }

  asBinary(command: Command): Buffer {
    return Buffer.of(); // TODO
  }
}
