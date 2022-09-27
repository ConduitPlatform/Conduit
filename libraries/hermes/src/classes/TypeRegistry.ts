import ConduitGrpcSdk, {
  ConduitModel,
  ConduitModelField,
} from '@conduitplatform/grpc-sdk';

type TransportUpdateHandler = (typeName: string, typeFields: ConduitModel) => void;

// Limitations & Optimizations:
// - Schema types are not removed from requestedTypes upon deregistration of the routes referencing them

export class TypeRegistry {
  private static instance: TypeRegistry;
  private static transportUpdateHandlers: Map<string, TransportUpdateHandler> = new Map();
  private readonly schemaTypes: Map<string, { fields: ConduitModel; hash: string }> =
    new Map();
  private readonly requestedTypes: Set<string> = new Set();
  private dbAvailable = false;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.waitForDatabase().then();
    this.grpcSdk.bus!.subscribe('database:create:schema', async syncSchema => {
      const schema = JSON.parse(syncSchema);
      this.setType(schema.name, schema.compiledFields, schema.fieldHash);
    });
    this.grpcSdk.bus!.subscribe('database:delete:schema', async schemaName => {
      this.schemaTypes.delete(schemaName);
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
            this.removeHiddenFields(schema.fields);
            this.schemaTypes.set(schema.name, {
              fields: schema.fields,
              hash: schema.fieldHash,
            }); // gRPC fields = compiledFields
          });
        })
        .catch(error => {
          ConduitGrpcSdk.Logger.error(error);
        });
    });
  }

  setType(schemaName: string, schemaFields: ConduitModel, fieldHash: string) {
    const typeUpdate = this.schemaTypes.get(schemaName)?.hash !== fieldHash;
    if (!typeUpdate) return;
    this.removeHiddenFields(schemaFields);
    this.schemaTypes.set(schemaName, { fields: schemaFields, hash: fieldHash });
    if (this.requestedTypes.has(schemaName)) {
      TypeRegistry.transportUpdateHandlers.forEach(handler => {
        handler(schemaName, schemaFields);
      });
    }
  }

  getType(typeName: string) {
    this.requestedTypes.add(typeName);
    return this.schemaTypes.get(typeName)?.fields;
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

  private removeHiddenFields(schemaFields: ConduitModel) {
    Object.keys(schemaFields).forEach(field => {
      const targetObject: ConduitModelField | null = Array.isArray(schemaFields[field])
        ? (schemaFields[field] as ConduitModelField[])[0]
        : typeof schemaFields[field] === 'object'
        ? (schemaFields[field] as ConduitModelField)
        : null;
      if (!targetObject) return;
      if (targetObject.select !== false) {
        this.removeHiddenFields(targetObject as ConduitModel);
      } else {
        delete schemaFields[field];
      }
    });
  }
}
