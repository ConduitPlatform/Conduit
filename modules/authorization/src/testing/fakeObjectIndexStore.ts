import { ObjectIndex } from '../models/index.js';
import { withObjectIndexKey } from '../utils/index.js';

export type Row = Partial<ObjectIndex> & { _id: string };
export type Query = Record<string, unknown>;

/**
 * Just enough of the ObjectIndex model for the connection job and the key migration,
 * including the unique index on `key` (rows without a key are outside it, as with
 * the sparse Mongo index and NULLs on SQL).
 */
export class FakeObjectIndexStore {
  rows: Row[] = [];
  private nextId = 1;
  /** Runs after every findMany has read; lets a test pause a job holding a stale result. */
  afterFind: (query: Query) => Promise<void> = async () => {};
  /** false acts like an older database module, which ignores `ignoreDuplicates`. */
  ignoreDuplicatesSupported = true;

  reset() {
    this.rows = [];
    this.afterFind = async () => {};
    this.ignoreDuplicatesSupported = true;
  }

  /** Rows as the current writers store them: schema defaults plus `key`. */
  seed(rows: Partial<ObjectIndex>[]) {
    this.insert(rows.map(row => withObjectIndexKey(withDefaults(row))));
  }

  /** Rows written before `key` existed. */
  seedLegacy(rows: Partial<ObjectIndex>[]) {
    this.insert(rows.map(withDefaults));
  }

  private insert(rows: Partial<ObjectIndex>[]) {
    for (const row of rows) {
      // zero-padded so string order is insertion order, like ObjectIds
      this.rows.push({ ...row, _id: String(this.nextId++).padStart(6, '0') });
    }
  }

  private keyTaken(key: string | undefined, exceptId?: string) {
    return !!key && this.rows.some(row => row.key === key && row._id !== exceptId);
  }

  findMany = async (
    query: Query,
    _select?: string,
    _skip?: number,
    limit?: number,
    sort?: Record<string, 1 | -1>,
  ) => {
    let result = this.rows.filter(row => matches(row, query)).map(row => ({ ...row }));
    if (sort?._id) {
      const dir = sort._id;
      result.sort((a, b) => (a._id < b._id ? -dir : a._id > b._id ? dir : 0));
    }
    if (limit) result = result.slice(0, limit);
    await this.afterFind(query);
    return result;
  };

  findOne = async (query: Query) => {
    const row = this.rows.find(row => matches(row, query));
    return row ? { ...row } : null;
  };

  createMany = async (
    rows: Partial<ObjectIndex>[],
    options?: { ignoreDuplicates?: boolean },
  ) => {
    const ignore = options?.ignoreDuplicates && this.ignoreDuplicatesSupported;
    const inserted: Partial<ObjectIndex>[] = [];
    const batchKeys = new Set<string>();
    // Checked before inserting anything: a failed call stores nothing, like SQL.
    for (const row of rows.map(withDefaults)) {
      if (!row.key) throw new Error('ObjectIndex row written without a key');
      if (this.keyTaken(row.key) || batchKeys.has(row.key)) {
        if (ignore) continue;
        throw new Error('E11000 duplicate key error');
      }
      batchKeys.add(row.key);
      inserted.push(row);
    }
    this.insert(inserted);
    return inserted;
  };

  findByIdAndUpdate = async (id: string, update: Partial<ObjectIndex>) => {
    if (this.keyTaken(update.key, id)) throw new Error('E11000 duplicate key error');
    const row = this.rows.find(row => row._id === id);
    if (row) Object.assign(row, update);
    return row ?? null;
  };

  deleteMany = async (query: Query) => {
    this.rows = this.rows.filter(row => !matches(row, query));
  };

  entitiesOf(subject: string) {
    return this.rows.filter(row => row.subject === subject);
  }
}

function withDefaults(row: Partial<ObjectIndex>): Partial<ObjectIndex> {
  return { entityPermission: '', relation: '', inheritanceTree: [], ...row };
}

function matches(row: Row, query: Query): boolean {
  return Object.entries(query).every(([field, condition]) => {
    if (field === '$and') return (condition as Query[]).every(q => matches(row, q));
    if (field === '$or') return (condition as Query[]).some(q => matches(row, q));
    const value = (row as Record<string, unknown>)[field];
    // like Mongo: null matches a missing field too
    if (condition === null) return value === null || value === undefined;
    if (condition && typeof condition === 'object') {
      const c = condition as {
        $in?: unknown[];
        $ne?: unknown;
        $gt?: string;
        $exists?: boolean;
      };
      if (c.$in) return c.$in.includes(value);
      if ('$exists' in c) return (value !== null && value !== undefined) === c.$exists;
      if ('$ne' in c) return value !== c.$ne;
      if ('$gt' in c) return typeof value === 'string' && value > c.$gt!;
    }
    return value === condition;
  });
}
