import { SequelizeAdapter } from '../index.js';
import pgvector from 'pgvector/sequelize';
import { Sequelize } from 'sequelize';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class PostgresAdapter extends SequelizeAdapter {
  constructor(connectionUri: string) {
    pgvector.registerTypes(Sequelize);
    super(connectionUri);
  }

  protected async ensureConnected() {
    await super.ensureConnected();
    await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector').catch(() => {
      // Capability probing reports missing privileges/extension support later. Keeping
      // startup alive lets non-vector schemas continue to work on restricted Postgres.
    });
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
