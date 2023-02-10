import { Sequelize } from 'sequelize';

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
