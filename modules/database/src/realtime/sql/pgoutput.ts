export type PgoutputRelation = {
  oid: number;
  schema: string;
  name: string;
  columns: string[];
};

export type PgoutputChange = {
  tag: 'insert' | 'update' | 'delete';
  relation: PgoutputRelation;
  newRow?: Record<string, string | null>;
  oldRow?: Record<string, string | null>;
  keyRow?: Record<string, string | null>;
};

export type PgoutputBegin = {
  tag: 'begin';
  finalLsn: bigint;
  commitTime: Date;
  xid: number;
};

const POSTGRES_EPOCH_MS = Date.UTC(2000, 0, 1);

export class BufferReader {
  constructor(
    private readonly buf: Buffer,
    private offset = 0,
  ) {}

  u8(): number {
    const value = this.buf[this.offset];
    this.offset += 1;
    return value;
  }

  i16(): number {
    const value = this.buf.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  i32(): number {
    const value = this.buf.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  i64(): bigint {
    const value = this.buf.readBigInt64BE(this.offset);
    this.offset += 8;
    return value;
  }

  u64(): bigint {
    const value = this.buf.readBigUInt64BE(this.offset);
    this.offset += 8;
    return value;
  }

  cstring(): string {
    const start = this.offset;
    while (this.offset < this.buf.length && this.buf[this.offset] !== 0) {
      this.offset += 1;
    }
    const value = this.buf.subarray(start, this.offset).toString('utf8');
    this.offset += 1;
    return value;
  }

  bytes(length: number): Buffer {
    const value = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  char(): string {
    return String.fromCharCode(this.u8());
  }
}

export function postgresTimeToDate(microseconds: bigint): Date {
  return new Date(POSTGRES_EPOCH_MS + Number(microseconds / 1000n));
}

export function nowPostgresMicros(): bigint {
  return BigInt(Date.now() - POSTGRES_EPOCH_MS) * 1000n;
}

export function formatLsn(lsn: bigint): string {
  const hi = Number(lsn >> 32n) >>> 0;
  const lo = Number(lsn & 0xffffffffn) >>> 0;
  return `${hi.toString(16).toUpperCase()}/${lo.toString(16).toUpperCase().padStart(8, '0')}`;
}

export function parseLsn(value: string): bigint {
  const [hi, lo] = value.split('/');
  if (!hi || !lo) {
    throw new Error(`Invalid LSN: ${value}`);
  }
  return (BigInt(parseInt(hi, 16)) << 32n) + BigInt(parseInt(lo, 16));
}

export class PgoutputDecoder {
  private readonly relations = new Map<number, PgoutputRelation>();

  decodeMessage(payload: Buffer): PgoutputBegin | PgoutputChange | undefined {
    if (payload.length === 0) return undefined;
    const reader = new BufferReader(payload);
    const tag = reader.char();
    switch (tag) {
      case 'B':
        return this.begin(reader);
      case 'R':
        this.relation(reader);
        return undefined;
      case 'I':
        return this.insert(reader);
      case 'U':
        return this.update(reader);
      case 'D':
        return this.delete(reader);
      default:
        return undefined;
    }
  }

  private begin(reader: BufferReader): PgoutputBegin {
    const finalLsn = reader.u64();
    const commitTime = postgresTimeToDate(reader.i64());
    const xid = reader.i32();
    return { tag: 'begin', finalLsn, commitTime, xid };
  }

  private relation(reader: BufferReader): void {
    const oid = reader.i32();
    const schema = reader.cstring();
    const name = reader.cstring();
    reader.u8();
    const columnCount = reader.i16();
    const columns: string[] = [];
    for (let i = 0; i < columnCount; i++) {
      reader.u8();
      columns.push(reader.cstring());
      reader.i32();
      reader.i32();
    }
    this.relations.set(oid, { oid, schema, name, columns });
  }

  private insert(reader: BufferReader): PgoutputChange | undefined {
    const relation = this.relations.get(reader.i32());
    if (!relation) return undefined;
    if (reader.char() !== 'N') return undefined;
    return {
      tag: 'insert',
      relation,
      newRow: readTuple(reader, relation.columns),
    };
  }

  private update(reader: BufferReader): PgoutputChange | undefined {
    const relation = this.relations.get(reader.i32());
    if (!relation) return undefined;
    let keyRow: Record<string, string | null> | undefined;
    let oldRow: Record<string, string | null> | undefined;
    let kind = reader.char();
    if (kind === 'K' || kind === 'O') {
      const row = readTuple(reader, relation.columns);
      if (kind === 'K') keyRow = row;
      else oldRow = row;
      kind = reader.char();
    }
    if (kind !== 'N') return undefined;
    return {
      tag: 'update',
      relation,
      newRow: readTuple(reader, relation.columns),
      oldRow,
      keyRow,
    };
  }

  private delete(reader: BufferReader): PgoutputChange | undefined {
    const relation = this.relations.get(reader.i32());
    if (!relation) return undefined;
    const kind = reader.char();
    if (kind !== 'K' && kind !== 'O') return undefined;
    const row = readTuple(reader, relation.columns);
    return {
      tag: 'delete',
      relation,
      oldRow: kind === 'O' ? row : undefined,
      keyRow: kind === 'K' ? row : undefined,
    };
  }
}

function readTuple(
  reader: BufferReader,
  columns: string[],
): Record<string, string | null> {
  const count = reader.i16();
  const row: Record<string, string | null> = {};
  for (let i = 0; i < count; i++) {
    const name = columns[i];
    const kind = reader.char();
    if (kind === 'n') {
      if (name) row[name] = null;
      continue;
    }
    if (kind !== 't') continue;
    const length = reader.i32();
    const value = reader.bytes(length).toString('utf8');
    if (name) row[name] = value;
  }
  return row;
}
