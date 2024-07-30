import { SequelizeAdapter } from '../index.js';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class PostgresAdapter extends SequelizeAdapter {
  constructor(connectionUri: string) {
    super(connectionUri);
  }

  protected async hasLegacyCollections() {
    const res = await this.sequelize
      .query(
        `SELECT EXISTS (
    SELECT FROM 
        information_schema.tables 
    WHERE 
        table_schema LIKE '${sqlSchemaName}' AND 
        table_type LIKE 'BASE TABLE' AND
        table_name = '_DeclaredSchema'
    );`,
      )
      .then(r => (r[0][0] as { exists: boolean }).exists);
    return res;
  }
}
