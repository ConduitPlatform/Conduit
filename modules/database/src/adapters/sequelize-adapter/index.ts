import { Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import ConduitGrpcSdk, {
  ConduitModel,
  ConduitSchema,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from '../utils/extensions';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto } from 'sequelize-auto';
import { sqlSchemaConverter } from '../../introspection/sequelize/utils';
import { isNil } from 'lodash';
import { sleep } from '@conduitplatform/grpc-sdk/dist/utilities';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class SequelizeAdapter extends DatabaseAdapter<SequelizeSchema> {
  connectionUri: string;
  sequelize: Sequelize;

  constructor(connectionUri: string) {
    super();
    this.registeredSchemas = new Map();
    this.connectionUri = connectionUri;
  }

  connect() {
    this.sequelize = new Sequelize(this.connectionUri, { logging: false });
  }

  async retrieveForeignSchemas(): Promise<void> {
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    const tableNames: string[] = (
      await this.sequelize.query(
        `select * from pg_tables where schemaname='${sqlSchemaName}';`,
      )
    )[0].map((t: any) => t.tablename);
    const declaredSchemaTableName = this.models['_DeclaredSchema'].originalSchema
      .collectionName;
    for (const table of tableNames) {
      if (table === declaredSchemaTableName) continue;
      const tableInDeclaredSchemas = declaredSchemas.some(
        (declaredSchema: ConduitSchema) => {
          if (declaredSchema.collectionName && declaredSchema.collectionName !== '') {
            return declaredSchema.collectionName === table;
          } else {
            return declaredSchema.name === table;
          }
        },
      );
      if (!tableInDeclaredSchemas) {
        this.foreignSchemaCollections.add(table);
      }
    }
  }

  async introspectDatabase(): Promise<ConduitSchema[]> {
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
    const introspectedSchemas: ConduitSchema[] = [];
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    // Wipe Pending Schemas
    const pendingSchemaCollectionName = this.models['_PendingSchemas'].originalSchema
      .collectionName;
    await this.getSchemaModel(pendingSchemaCollectionName).model.deleteMany({});
    // Update Collection Names and Find Introspectable Schemas
    const importedSchemas: string[] = [];
    declaredSchemas.forEach((schema: ConduitSchema) => {
      this.updateCollectionName(schema);
      if ((schema as Indexable).modelOptions.conduit.imported) {
        importedSchemas.push(schema.collectionName);
      }
    });
    const introspectableSchemas = Array.from(this.foreignSchemaCollections).concat(
      importedSchemas,
    );
    // Process Schemas
    const auto = new SequelizeAuto(this.sequelize, '', '', {
      ...options,
      tables: introspectableSchemas,
    });
    const data = await auto.run();
    const tables = Object.fromEntries(
      Object.entries(data.tables).filter(([key]) =>
        introspectableSchemas.includes(key.replace(`${sqlSchemaName}.`, '')),
      ),
    );
    for (const tableName of Object.keys(tables)) {
      const table = tables[tableName];
      const originalName = tableName.split('.')[1];
      const schema = await this.introspectSchema(table, originalName);
      introspectedSchemas.push(schema);
      ConduitGrpcSdk.Logger.log(`Introspected schema ${originalName}`);
    }
    return introspectedSchemas;
  }

  async introspectSchema(table: Indexable, originalName: string): Promise<ConduitSchema> {
    sqlSchemaConverter(table);

    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`,
    );
    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW()`,
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
          crudOperations: {
            create: {
              enabled: false,
              authenticated: false,
            },
            read: {
              enabled: false,
              authenticated: false,
            },
            update: {
              enabled: false,
              authenticated: false,
            },
            delete: {
              enabled: false,
              authenticated: false,
            },
          },
          enabled: true,
        },
      },
    });
    schema.ownerModule = 'database';

    return schema;
  }

  protected updateCollectionName(schema: ConduitSchema, setPrefix = false) {
    let collectionName =
      schema.collectionName && schema.collectionName !== ''
        ? schema.collectionName
        : schema.name;
    if (setPrefix && this.foreignSchemaCollections.has(collectionName)) {
      collectionName = collectionName.startsWith('_')
        ? `cnd${collectionName}`
        : `cnd_${collectionName}`;
    }
    (schema as any).collectionName = collectionName;
    (schema as any).name = collectionName;
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitSchema,
  ): Promise<SequelizeSchema> {
    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== 'Config') {
        schema = systemRequiredValidator(
          this.registeredSchemas.get(schema.name)!,
          schema,
        );
      }
      delete this.sequelize.models[schema.name];
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }

    this.addSchemaPermissions(schema);
    const original: ConduitSchema = JSON.parse(JSON.stringify(schema));
    stitchSchema(schema);
    const newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new SequelizeSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
    );

    const noSync = this.models[schema.name].originalSchema.schemaOptions.conduit!.noSync;
    if (isNil(noSync) || !noSync) {
      await this.models[schema.name].sync();
    }
    await this.saveSchemaToDatabase(original);

    return this.models[schema.name];
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (this.models[schemaName].originalSchema.ownerModule !== callerModule) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models[schemaName].model.drop();
    }
    this.models['_DeclaredSchema']
      .findOne(JSON.stringify({ name: schemaName }))
      .then(model => {
        if (model) {
          this.models['_DeclaredSchema']
            .deleteOne(JSON.stringify({ name: schemaName }))
            .catch((e: Error) => {
              throw new GrpcError(status.INTERNAL, e.message);
            });
        }
      });
    delete this.models[schemaName];
    delete this.sequelize.models[schemaName];
    return 'Schema deleted!';
  }

  getSchemaModel(schemaName: string): { model: SequelizeSchema; relations: Indexable } {
    if (this.models && this.models[schemaName]) {
      const self = this;
      const relations: Indexable = {};
      for (const key in this.models[schemaName].relations) {
        relations[this.models[schemaName].relations[key]] =
          self.models[this.models[schemaName].relations[key]];
      }
      return { model: this.models[schemaName], relations };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async ensureConnected() {
    let error;
    ConduitGrpcSdk.Logger.log('Connecting to database...');
    for (let i = 0; i < this.maxConnTimeoutMs / 200; i++) {
      try {
        await this.sequelize.authenticate();
        ConduitGrpcSdk.Logger.log('Sequelize connection established successfully');
        return;
      } catch (err) {
        error = err;
        if (error.original.code !== 'ECONNREFUSED') break;
        await sleep(200);
      }
    }
    if (error) {
      ConduitGrpcSdk.Logger.error('Unable to connect to the database: ', error);
      throw new Error();
    }
  }
}
