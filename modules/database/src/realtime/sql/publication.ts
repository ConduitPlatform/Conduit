import { QueryTypes, Sequelize } from 'sequelize';
import type { OptedInSchema } from '../types.js';
import { PUBLICATION_NAME } from './constants.js';
import { quoteIdent, quoteQualified } from './identifiers.js';

export type PublicationTable = {
  schema: string;
  table: string;
};

export function createPublicationSql(publicationName: string = PUBLICATION_NAME): string {
  return `CREATE PUBLICATION ${quoteIdent(publicationName)} WITH (publish = 'insert,update,delete')`;
}

export function addPublicationTableSql(
  publicationName: string,
  schema: string,
  table: string,
): string {
  return `ALTER PUBLICATION ${quoteIdent(publicationName)} ADD TABLE ${quoteQualified(schema, table)}`;
}

export function dropPublicationTableSql(
  publicationName: string,
  schema: string,
  table: string,
): string {
  return `ALTER PUBLICATION ${quoteIdent(publicationName)} DROP TABLE ${quoteQualified(schema, table)}`;
}

export function replicaIdentityFullSql(schema: string, table: string): string {
  return `ALTER TABLE ${quoteQualified(schema, table)} REPLICA IDENTITY FULL`;
}

export async function ensurePublication(
  sequelize: Sequelize,
  publicationName: string = PUBLICATION_NAME,
): Promise<void> {
  const rows = await sequelize.query(
    `SELECT pubname FROM pg_publication WHERE pubname = :name`,
    { type: QueryTypes.SELECT, replacements: { name: publicationName } },
  );
  if (rows.length > 0) return;
  try {
    await sequelize.query(createPublicationSql(publicationName));
  } catch (err) {
    if (!isAlreadyPresent(err)) throw err;
  }
}

export async function listPublicationTables(
  sequelize: Sequelize,
  publicationName: string = PUBLICATION_NAME,
): Promise<PublicationTable[]> {
  const rows = await sequelize.query(
    `SELECT schemaname AS schema_name, tablename AS table_name
     FROM pg_publication_tables
     WHERE pubname = :name`,
    { type: QueryTypes.SELECT, replacements: { name: publicationName } },
  );
  return (rows as { schema_name: string; table_name: string }[]).map(row => ({
    schema: String(row.schema_name),
    table: String(row.table_name),
  }));
}

export async function syncPublication(
  sequelize: Sequelize,
  schemas: OptedInSchema[],
  options: { schemaName: string; publicationName?: string },
): Promise<void> {
  const publicationName = options.publicationName ?? PUBLICATION_NAME;
  await ensurePublication(sequelize, publicationName);
  const desired = new Map<string, PublicationTable>();
  for (const schema of schemas) {
    desired.set(tableKey(options.schemaName, schema.collectionName), {
      schema: options.schemaName,
      table: schema.collectionName,
    });
  }
  const existing = await listPublicationTables(sequelize, publicationName);
  for (const current of existing) {
    if (desired.has(tableKey(current.schema, current.table))) continue;
    await sequelize.query(
      dropPublicationTableSql(publicationName, current.schema, current.table),
    );
  }
  const afterDrop = new Set(
    (await listPublicationTables(sequelize, publicationName)).map(table =>
      tableKey(table.schema, table.table),
    ),
  );
  for (const table of desired.values()) {
    const key = tableKey(table.schema, table.table);
    await ensureReplicaIdentity(sequelize, table.schema, table.table);
    if (afterDrop.has(key)) continue;
    try {
      await sequelize.query(
        addPublicationTableSql(publicationName, table.schema, table.table),
      );
    } catch (err) {
      if (!isAlreadyPresent(err)) throw err;
    }
  }
}

async function ensureReplicaIdentity(
  sequelize: Sequelize,
  schema: string,
  table: string,
): Promise<void> {
  const rows = await sequelize.query(
    `SELECT c.relreplident AS ident,
            EXISTS (
              SELECT 1 FROM pg_index i
              WHERE i.indrelid = c.oid AND i.indisprimary
            ) AS has_pk
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = :schema AND c.relname = :table AND c.relkind = 'r'`,
    { type: QueryTypes.SELECT, replacements: { schema, table } },
  );
  const row = rows[0] as { ident?: string; has_pk?: unknown } | undefined;
  if (!row) {
    throw new Error(
      `PostgreSQL live updates cannot publish ${quoteQualified(schema, table)}: table not found`,
    );
  }
  if (truthy(row.has_pk) || row.ident === 'f' || row.ident === 'i') {
    return;
  }
  await sequelize.query(replicaIdentityFullSql(schema, table));
}

function tableKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

function truthy(value: unknown): boolean {
  return (
    value === true || value === 't' || value === 'true' || value === 1 || value === '1'
  );
}

function isAlreadyPresent(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already member|already exists/i.test(message);
}
