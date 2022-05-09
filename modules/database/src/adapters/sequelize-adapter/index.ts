import { QueryTypes, Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitModel, ConduitSchema, GrpcError } from '@conduitplatform/grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from '../utils/extensions';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto, TableData } from 'sequelize-auto';
import {
  sqlSchemaConverter,
  INITIAL_DB_SCHEMAS,
} from '../../introspection/sequelize/utils';
import { isNil } from 'lodash';
import { isMatch } from 'lodash';
import { MultiDocQuery } from '../../interfaces';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class SequelizeAdapter extends DatabaseAdapter<SequelizeSchema> {
  connected: boolean = false;
  connectionUri: string;
  sequelize: Sequelize;
  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionUri: string) {
    super();
    this.registeredSchemas = new Map();
    this.connectionUri = connectionUri;
  }

  connect() {
    this.sequelize = new Sequelize(this.connectionUri, { logging: false });
  }


  async isConduitDb() {
    return this.sequelize
      .query(`SELECT COUNT(*) FROM "_DeclaredSchema" WHERE "ownerModule"='core'`)
      .then((res) => parseInt((res as any)[0][0].count) > 0)
      .catch((e) => {
        console.log(e);
        return false;
      });
  }

  async introspectDatabase(isConduitDb: boolean = true): Promise<ConduitSchema[]> {
    const options = {
      directory: '',
      additional: {
        timestamps: true,
      },
      singularize: true,
      useDefine: true,
      closeConnectionAutomatically: false,
      schema: sqlSchemaName,
    };
    let introspectedSchemas : ConduitSchema[] = [];
    let data: TableData;
    let tables: any;
    let tableNames = (
      await this.sequelize.query(
        `select * from pg_tables where schemaname='${sqlSchemaName}';`
      )
    )[0].map((t: any) => t.tablename);

    if (isConduitDb) {
      await this.getSchemaModel('_PendingSchemas').model.deleteMany({});
      let declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
        {}
      );

      tableNames = tableNames.filter((table: string) => {
        // Filter out non-imported declared schemas
        return (
          !INITIAL_DB_SCHEMAS.includes(table) &&
          !declaredSchemas.find((declaredSchema: ConduitSchema) => {
            return (
              declaredSchema.name === table &&
              isNil((declaredSchema as any).modelOptions.conduit!.imported)
            );
          })
        );
      });

      const auto = new SequelizeAuto(this.sequelize, '', '', {
        ...options,
        tables: tableNames,
      });
      data = await auto.run();

      for (let tableName of Object.keys(data.tables)) {
        let table = data.tables[tableName];
        tableName = tableName.split('.')[1];
        let declaredSchema = declaredSchemas.find(
          (declaredSchema: ConduitSchema) => declaredSchema.name === tableName
        );
        if (!isNil(declaredSchema)) {
          // check for diffs in existing schemas
          const schema = await this.introspectSchema(table, tableName);
          if (isMatch(schema.fields, declaredSchema.fields)) {
            tableNames.splice(tableNames.indexOf(tableName), 1);
          }
        }
      }
    } else {
      tableNames = tableNames.filter(
        (table: string) => !INITIAL_DB_SCHEMAS.includes(table)
      );
      const auto = new SequelizeAuto(this.sequelize, '', '', options);
      data = await auto.run();
    }

    tables = Object.fromEntries(
      Object.entries(data.tables).filter(
        ([key]) => tableNames.includes(key.replace(`${sqlSchemaName}.`, ''))
      )
    );

    for (const tableName of Object.keys(tables)) {
      let table = tables[tableName];
      const originalName = tableName.split('.')[1];

      const schema = await this.introspectSchema(table, originalName);

      introspectedSchemas.push(schema);
      console.log(`Introspected schema ${originalName}`);
    }
    return introspectedSchemas;
  }

  async introspectSchema(table: any, originalName: string): Promise<ConduitSchema> {
    sqlSchemaConverter(table);

    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`
    );
    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW()`
    );

    const schema = new ConduitSchema(originalName, table as ConduitModel, {
      timestamps: true,
      conduit: {
        noSync: true,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing',
          canDelete: false,
        },
        cms: {
          authentication: false,
          crudOperations: false,
          enabled: false,
        },
      },
    });
    schema.ownerModule = 'database';

    return schema;
  }

  async createSchemaFromAdapter(schema: ConduitSchema): Promise<SequelizeSchema> {
    if (!this.models) {
      this.models = {};
    }

    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== 'Config') {
        schema = systemRequiredValidator(
          this.registeredSchemas.get(schema.name)!,
          schema
        );
      }
      delete this.sequelize.models[schema.name];
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }

    this.addSchemaPermissions(schema);
    const original: any = JSON.parse(JSON.stringify(schema));
    stitchSchema(schema);
    const newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new SequelizeSchema(
      this.sequelize,
      newSchema,
      schema,
      this
    );

    const noSync = this.models[schema.name].originalSchema.schemaOptions.conduit.noSync;
    if (isNil(noSync) || !noSync) {
      await this.models[schema.name].sync();
    }

    if (schema.name !== '_DeclaredSchema') {
      await this.saveSchemaToDatabase(original);
    }
    return this.models![schema.name];
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database'
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (
      this.models[schemaName].originalSchema.ownerModule !== callerModule &&
      this.models[schemaName].originalSchema.name !== 'SchemaDefinitions' // SchemaDefinitions migration
    ) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models![schemaName].model.drop();
    }
    this.models!['_DeclaredSchema'].findOne(JSON.stringify({ name: schemaName })).then(
      (model) => {
        if (model) {
          this.models!['_DeclaredSchema'].deleteOne(
            JSON.stringify({ name: schemaName })
          ).catch((e: Error) => {
            throw new GrpcError(status.INTERNAL, e.message);
          });
        }
      }
    );
    delete this.models![schemaName];
    delete this.sequelize.models[schemaName];
    return 'Schema deleted!';
  }

  getSchemaModel(schemaName: string): { model: SequelizeSchema; relations: any } {
    if (this.models && this.models![schemaName]) {
      const self = this;
      let relations: any = {};
      for (const key in this.models[schemaName].relations) {
        relations[this.models[schemaName].relations[key]] = self.models![
          this.models[schemaName].relations[key]
        ];
      }
      return { model: this.models[schemaName], relations };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async ensureConnected(): Promise<any> {
    return this.sequelize
      .authenticate()
      .then(() => {
        console.log('Sequelize connection established successfully');
        return;
      })
      .catch((err: any) => {
        console.error('Unable to connect to the database: ', err);
        throw err;
      });
  }
}
