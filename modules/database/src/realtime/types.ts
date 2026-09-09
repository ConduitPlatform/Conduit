export const DATABASE_CHANGE_EVENT_VERSION = 1 as const;

export const DATABASE_CHANGE_OPERATIONS = [
  'insert',
  'update',
  'replace',
  'delete',
] as const;

export type DatabaseChangeOperation = (typeof DATABASE_CHANGE_OPERATIONS)[number];

export type DatabaseChangeEvent = {
  version: typeof DATABASE_CHANGE_EVENT_VERSION;
  operation: DatabaseChangeOperation;
  schema: string;
  documentId: string;
  occurredAt: string;
  resumeToken: string;
};

export type RealtimeStatusCode =
  'unsupported' | 'disabled' | 'idle' | 'starting' | 'live' | 'degraded';

export type RealtimeStatus = {
  status: RealtimeStatusCode;
  engine: string;
  activeSchemaCount: number;
  lastEventAt?: string;
  message?: string;
};

export type OptedInSchema = {
  name: string;
  collectionName: string;
  authorizationEnabled: boolean;
};

export type SubscribeRequest = {
  schema?: unknown;
  documentId?: unknown;
};

export type ChangeStreamLike = {
  on(
    event: 'change' | 'error' | 'close' | 'end',
    listener: (...args: unknown[]) => void,
  ): void;
  close(): Promise<void> | void;
};
