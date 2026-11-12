import { Metadata, status } from '@grpc/grpc-js';

export * from './db.js';
export * from './options.js';
export * from './peers.js';

export type GrpcRequest<T> = { request: T; metadata?: Metadata };
export type GrpcResponse<T> = (
  err: {
    code: number;
    message: string;
  } | null,
  res?: T,
) => void;

export class GrpcError extends Error {
  code: status;
  message: string;
  /** Marks gRPC status errors so they can be told apart from driver errors with a numeric `code`. */
  readonly isGrpcError = true;

  constructor(code: status, message: string) {
    super(message);
    this.code = code;
    this.message = message;
  }
}

export enum HealthCheckStatus {
  UNKNOWN,
  SERVING,
  NOT_SERVING,
  SERVICE_UNKNOWN,
}

export enum MetricType {
  Counter,
  Gauge,
  Histogram,
  Summary,
}
