import ConduitGrpcSdk, { ConduitModel } from '@conduitplatform/grpc-sdk';
import { sleep } from '@conduitplatform/grpc-sdk/dist/utilities';

type TransportUpdateHandler = (typeName: string, typeFields: ConduitModel) => void;

// Limitations:
// Schema types are not removed from requestedTypes upon deregistration of the routes referencing them

export class TypeRegistry {
  private static instance: TypeRegistry;
  private static transportUpdateHandlers: Map<string, TransportUpdateHandler> = new Map();
  private readonly schemaTypes: Map<string, ConduitModel> = new Map();
  private readonly pendingTypes: Set<string> = new Set();
  private readonly requestedTypes: Set<string> = new Set();
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
        // Only update route docs for explicitly requested types upon schema changes
        if (schema && this.requestedTypes.has(schema.name)) {
          const typeUpdate = this.schemaTypes.get(schemaName) !== schema.fields; // use lodash.isEqual() or hash ???
          this.schemaTypes.set(schemaName, schema.fields);
          if (typeUpdate) {
            TypeRegistry.transportUpdateHandlers.forEach(handler => {
              handler(schemaName, schema.fields);
            });
          }
        }
      })
      .catch(error => {
        ConduitGrpcSdk.Logger.error(error);
      });
  }

  getType(typeName: string) {
    this.requestedTypes.add(typeName);
    return this.schemaTypes.get(typeName);
  }

  static getInstance(
    grpcSdk?: ConduitGrpcSdk,
    transport?: { name: string; updateHandler: TransportUpdateHandler },
  ): TypeRegistry {
    if (!TypeRegistry.instance) {
      if (!grpcSdk) throw new Error('No grpc-sdk instance provided!');
      if (!transport) throw new Error('No transport object provided!');
      TypeRegistry.instance = new TypeRegistry(grpcSdk);
    }
    if (transport) {
      TypeRegistry.transportUpdateHandlers.set(transport.name, transport.updateHandler);
    }
    return TypeRegistry.instance;
  }

  static removeTransport(name: string) {
    TypeRegistry.transportUpdateHandlers.delete(name);
  }
}
