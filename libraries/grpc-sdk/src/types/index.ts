import { Metadata, status } from '@grpc/grpc-js';
import {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  SummaryConfiguration,
} from 'prom-client';

export * from './db';
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

  constructor(code: status, message: string) {
    super(message);
    this.code = code;
    this.message = message;
  }
}

export type SetConfigRequest = GrpcRequest<{ newConfig: string }>;
export type SetConfigResponse = GrpcResponse<{ updatedConfig: string }>;

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
