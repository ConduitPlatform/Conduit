import type { DatabaseProvider } from '@conduitplatform/grpc-sdk';

export type Doc = Record<string, any>;

export function matches(doc: Doc, query: Doc): boolean {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return (condition as Doc[]).some(q => matches(doc, q));
    const value = doc[key];
    if (condition === null) return value === null || value === undefined;
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, arg]) => {
        switch (op) {
          case '$ne':
            return value !== arg;
          case '$in':
            return (arg as unknown[]).includes(value);
          case '$nin':
            return !(arg as unknown[]).includes(value);
          case '$gt':
            return value > (arg as Date);
          case '$gte':
            return value >= (arg as Date);
          case '$lt':
            return value < (arg as Date);
          case '$lte':
            return value <= (arg as Date);
          case '$exists':
            return (value !== undefined) === arg;
          default:
            throw new Error(`unsupported operator ${op}`);
        }
      });
    }
    return value === condition;
  });
}

/** In-memory stand-in for the database provider (just what the handlers call). */
export function createFakeDatabase() {
  const tables: Record<string, Doc[]> = {};
  let nextId = 0;
  const table = (name: string) => (tables[name] ??= []);
  const populate = (doc: Doc | undefined, options?: Doc) => {
    if (!doc) return null;
    const out = { ...doc };
    const fields: string[] = options?.populate ?? [];
    for (const field of fields) {
      const model =
        field === 'user' ? 'User' : field === 'accessToken' ? 'AccessToken' : null;
      if (model) out[field] = table(model).find(d => d._id === doc[field]) ?? null;
    }
    return out;
  };
  const database = {
    async findOne(name: string, query: Doc, options?: Doc) {
      return populate(
        table(name).find(doc => matches(doc, query)),
        options,
      );
    },
    async findMany(name: string, query: Doc, options?: Doc) {
      const rows = table(name).filter(doc => matches(doc, query));
      const skip = options?.skip ?? 0;
      return rows
        .slice(skip, skip + (options?.limit ?? rows.length))
        .map(r => ({ ...r }));
    },
    async create(name: string, doc: Doc) {
      nextId += 1;
      const now = new Date();
      const row = { _id: `${name}-${nextId}`, createdAt: now, updatedAt: now, ...doc };
      table(name).push(row);
      return { ...row };
    },
    async updateMany(name: string, query: Doc, patch: Doc) {
      const rows = table(name).filter(doc => matches(doc, query));
      rows.forEach(row => Object.assign(row, patch));
      return { matchedCount: rows.length, modifiedCount: rows.length };
    },
    async updateOne(name: string, query: Doc, patch: Doc) {
      const row = table(name).find(doc => matches(doc, query));
      if (row) Object.assign(row, patch);
      return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
    },
    async findByIdAndUpdate(name: string, id: string, patch: Doc) {
      const row = table(name).find(doc => doc._id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    async deleteOne(name: string, query: Doc) {
      const index = table(name).findIndex(doc => matches(doc, query));
      if (index < 0) return { deletedCount: 0 };
      table(name).splice(index, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(name: string, query: Doc) {
      const before = table(name).length;
      tables[name] = table(name).filter(doc => !matches(doc, query));
      return { deletedCount: before - tables[name].length };
    },
    // no transaction: the work runs against the plain calls, as in the fallback
    withOptionalTransaction<R>(work: (db: unknown) => Promise<R>): Promise<R> {
      return work(database);
    },
  };
  return { tables, table, database: database as unknown as DatabaseProvider };
}
