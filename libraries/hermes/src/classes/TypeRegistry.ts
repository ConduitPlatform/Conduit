import ConduitGrpcSdk, { ConduitModel } from '@conduitplatform/grpc-sdk';

// TODO: Update Database's proto/gRPC post-merge, replacing schema.fields with schema.compiledFields

export class TypeRegistry {
  private static instance: TypeRegistry;
  private schemaTypes: Map<string, ConduitModel> = new Map();

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.initializeTypes().then();
    this.grpcSdk.bus!.subscribe('database:dataTypes:registration', async schemaName => {
      await this.setType(schemaName);
    });
    this.grpcSdk.bus!.subscribe('database:dataTypes:deregistration', async schemaName => {
      await this.setType(schemaName);
    });
  }

  async initializeTypes() {
    // TODO; Remove initial dependency on Database
    await this.grpcSdk.waitForExistence('database');
    const schemas = await this.grpcSdk.database!.getSchemas();
    schemas.forEach(schema => {
      this.schemaTypes.set(schema.name, schema.fields);
    });
  }

  async setType(schemaName: string) {
    await this.grpcSdk.database
      ?.getSchema(schemaName)
      .catch(() => {})
      .then(schema => {
        if (schema) {
          this.schemaTypes.set(schemaName, schema.fields);
        }
      });
  }

  getType(typeName: string) {
    return this.schemaTypes.get(typeName);
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk): TypeRegistry {
    if (!TypeRegistry.instance) {
      if (!grpcSdk) throw new Error('No grpcSdk instance provided!');
      TypeRegistry.instance = new TypeRegistry(grpcSdk);
    }
    return TypeRegistry.instance;
  }
}
