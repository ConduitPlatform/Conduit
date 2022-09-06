import ConduitGrpcSdk, { ConduitModel } from '@conduitplatform/grpc-sdk';
import { sleep } from '@conduitplatform/grpc-sdk/dist/utilities';

export class TypeRegistry {
  private static instance: TypeRegistry;
  private readonly schemaTypes: Map<string, ConduitModel> = new Map();
  private readonly pendingTypes: Set<string> = new Set();
  private dbAvailable = false;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.waitForDatabase().then();
    this.grpcSdk.bus!.subscribe('database:dataTypes:registration', async schemaName => {
      await this.setType(schemaName);
    });
    this.grpcSdk.bus!.subscribe('database:dataTypes:deregistration', async schemaName => {
      await this.setType(schemaName);
    });
  }

  /**
   * Prevents a race condition caused by schema registration events being emitted before Database is available
   * through gRPC as the module only goes "Serving" after recovering all of its db-registered schemas.
   * */
  async waitForDatabase() {
    this.grpcSdk.waitForExistence('database').then(() => {
      this.dbAvailable = true;
      this.grpcSdk
        .database!.getSchemas()
        .then(schemas => {
          schemas.forEach(schema => {
            this.schemaTypes.set(schema.name, schema.fields);
            this.pendingTypes.delete(schema.name);
          });
        })
        .catch(error => {
          ConduitGrpcSdk.Logger.error(error);
        });
    });
  }

  async setType(schemaName: string) {
    if (!this.dbAvailable) {
      this.pendingTypes.add(schemaName);
      return;
    }
    await sleep(250); // prevent gRPC request flooding during early Core/Database initialization
    await this.grpcSdk
      .database!.getSchema(schemaName)
      .then(schema => {
        if (schema) {
          this.schemaTypes.set(schemaName, schema.fields);
        }
      })
      .catch(error => {
        ConduitGrpcSdk.Logger.error(error);
      });
  }

  getType(typeName: string) {
    return this.schemaTypes.get(typeName);
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk): TypeRegistry {
    if (!TypeRegistry.instance) {
      if (!grpcSdk) throw new Error('No grpc-sdk instance provided!');
      TypeRegistry.instance = new TypeRegistry(grpcSdk);
    }
    return TypeRegistry.instance;
  }
}
