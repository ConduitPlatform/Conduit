import { Metadata, status } from '@grpc/grpc-js';

export * from './db.js';
export * from './options.js';

export type GrpcRequest<T> = { request: T; metadata?: Metadata };
export type GrpcResponse<T> = (
  err: {
    code: number;
    message: string;
  } | null,
  res?: T,
) => void;

export enum AuthErrorCode {
  AUTH_USER_EXISTS = 'AUTH_USER_EXISTS',
}

const AuthErrors: Record<
  AuthErrorCode,
  {
    grpc_code: status;
    message: string;
    description: string;
  }
> = {
  [AuthErrorCode.AUTH_USER_EXISTS]: {
    grpc_code: status.ALREADY_EXISTS,
    message: 'User already exists',
    description: 'A user with this email already exists',
  },
};

export const ErrorRegistry = {
  ...AuthErrors,
};

export class GrpcError extends Error {
  code: status;
  message: string;
  debugLogInfo?: string;

  constructor(
    code: status | keyof typeof ErrorRegistry,
    message?: string,
    debugLogInfo?: string,
  ) {
    if (typeof code === 'string' && code in ErrorRegistry) {
      const entry = ErrorRegistry[code];
      super(entry.message);
      this.code = entry.grpc_code;
      this.message = JSON.stringify({ message: entry.message, conduitCode: code });
      this.debugLogInfo = debugLogInfo;
    } else {
      super(message);
      this.code = code as status;
      this.message = message ?? '';
      this.debugLogInfo = debugLogInfo;
    }
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
