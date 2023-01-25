import { Sequelize } from 'sequelize';

async function postgresLegacy(
  sequelize: Sequelize,
  sqlSchemaName: string,
): Promise<boolean> {
  return sequelize
    .query(
      `EXISTS (
    SELECT FROM 
        information_schema.tables 
    WHERE 
        table_schema LIKE '${sqlSchemaName}' AND 
        table_type LIKE 'BASE TABLE' AND
        table_name = '_DeclaredSchema'
    );`,
    )
    .then(r => (r[0][0] as { exists: boolean }).exists);
}

export function legacyCollections(
  sequelize: Sequelize,
  sqlSchemaName: string,
): Promise<boolean> {
  switch (sequelize.getDialect()) {
    case 'postgres':
      return postgresLegacy(sequelize, sqlSchemaName);
    default:
      return Promise.resolve(false);
  }
}

async function postgresTableFetch(sequelize: Sequelize, sqlSchemaName: string) {
  return sequelize
    .query(`select * from pg_tables where schemaname='${sqlSchemaName}';`)
    .then(r => {
      return r[0].map((t: any) => t.tablename);
    });
}

async function mysqlTableFetch(sequelize: Sequelize, sqlSchemaName: string) {
  return sequelize
    .query(
      `select table_name from information_schema.tables where table_type = 'BASE TABLE';`,
    )
    .then(r => {
      return r[0].map((t: any) => t.table_name);
    });
}

async function sqliteTableFetch(sequelize: Sequelize, sqlSchemaName: string) {
  return sequelize.query(`select * from sqlite_master where type='table';`).then(r => {
    return r[0].map((t: any) => t.name);
  });
}

export function tableFetch(
  sequelize: Sequelize,
  sqlSchemaName: string,
): Promise<string[]> {
  switch (sequelize.getDialect()) {
    case 'postgres':
      return postgresTableFetch(sequelize, sqlSchemaName);
    case 'mysql':
      return mysqlTableFetch(sequelize, sqlSchemaName);
    case 'sqlite':
      return sqliteTableFetch(sequelize, sqlSchemaName);
    case 'mariadb':
      return mysqlTableFetch(sequelize, sqlSchemaName);
    case 'mssql':
      return mysqlTableFetch(sequelize, sqlSchemaName);
    default:
      return Promise.resolve([]);
  }
}
