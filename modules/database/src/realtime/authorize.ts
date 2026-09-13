import { status } from '@grpc/grpc-js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import type { OptedInSchema, SubscribeRequest } from './types.js';

export class RealtimeSubscriptionError extends GrpcError {
  constructor(code: number, message: string) {
    super(code, message);
    this.name = 'RealtimeSubscriptionError';
  }
}

export type AuthorizationSdk = {
  isAvailable: (module: string) => boolean;
  authorization?: {
    can: (request: {
      subject: string;
      actions: string[];
      resource: string;
    }) => Promise<{ allow: boolean }>;
  } | null;
};

export type SchemaLookup = {
  getSchema(name: string):
    | {
        name: string;
        modelOptions?: {
          conduit?: {
            realtime?: { enabled?: boolean };
            cms?: { crudOperations?: { read?: { enabled?: boolean } } };
            authorization?: { enabled?: boolean };
          };
        };
      }
    | undefined;
};

export function parseSubscribeRequest(params: unknown[]): SubscribeRequest {
  const raw = params[0];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as SubscribeRequest;
  }
  return {};
}

export function requireSchemaName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RealtimeSubscriptionError(status.INVALID_ARGUMENT, 'schema is required');
  }
  return value.trim();
}

export function optionalDocumentId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new RealtimeSubscriptionError(
      status.INVALID_ARGUMENT,
      'documentId must be a string',
    );
  }
  return value;
}

export type DocumentReadDecision = 'allow' | 'deny' | 'unavailable';

export async function documentReadDecision(
  grpcSdk: AuthorizationSdk,
  schema: string,
  documentId: string,
  userId: string,
): Promise<DocumentReadDecision> {
  const auth = grpcSdk.authorization;
  if (!auth || !grpcSdk.isAvailable('authorization')) {
    return 'unavailable';
  }
  try {
    const decision = await auth.can({
      subject: `User:${userId}`,
      actions: ['read'],
      resource: `${schema}:${documentId}`,
    });
    return decision.allow === true ? 'allow' : 'deny';
  } catch {
    return 'unavailable';
  }
}

export async function canReadDocument(
  grpcSdk: AuthorizationSdk,
  schema: string,
  documentId: string,
  userId: string,
): Promise<boolean> {
  return (await documentReadDecision(grpcSdk, schema, documentId, userId)) === 'allow';
}

export function assertSchemaAvailable(
  lookup: SchemaLookup,
  schemaName: string,
  requireCmsRead: boolean,
): { authorizationEnabled: boolean } {
  let schema: ReturnType<SchemaLookup['getSchema']>;
  try {
    schema = lookup.getSchema(schemaName);
  } catch (err) {
    if (err instanceof GrpcError && err.code === status.NOT_FOUND) {
      throw new RealtimeSubscriptionError(status.NOT_FOUND, 'Schema does not exist');
    }
    throw err;
  }
  if (!schema) {
    throw new RealtimeSubscriptionError(status.NOT_FOUND, 'Schema does not exist');
  }
  const conduit = schema.modelOptions?.conduit;
  if (!conduit?.realtime?.enabled) {
    throw new RealtimeSubscriptionError(
      status.FAILED_PRECONDITION,
      'Live updates are not enabled for this schema',
    );
  }
  if (requireCmsRead && conduit.cms?.crudOperations?.read?.enabled !== true) {
    throw new RealtimeSubscriptionError(
      status.PERMISSION_DENIED,
      'CMS read is not enabled for this schema',
    );
  }
  return {
    authorizationEnabled: conduit.authorization?.enabled === true,
  };
}

export function toOptedInSchema(schema: {
  name: string;
  collectionName: string;
  documentIdField?: string;
  modelOptions?: {
    conduit?: {
      realtime?: { enabled?: boolean };
      authorization?: { enabled?: boolean };
    };
  };
}): OptedInSchema | null {
  if (!schema.modelOptions?.conduit?.realtime?.enabled) return null;
  return {
    name: schema.name,
    collectionName: schema.collectionName,
    authorizationEnabled: schema.modelOptions.conduit.authorization?.enabled === true,
    documentIdField: schema.documentIdField,
  };
}
