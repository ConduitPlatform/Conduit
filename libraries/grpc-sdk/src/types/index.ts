import { Metadata, status } from '@grpc/grpc-js';
import { Context, Params, Headers, Indexable } from '../interfaces';
import {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  SummaryConfiguration,
} from 'prom-client';

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

export type ParsedRouterRequest = GrpcRequest<{
  params: Params;
  path: string;
  headers: Headers;
  context: Context;
}>;

export type UnparsedRouterResponse =
  | {
      result?: Indexable;
      redirect?: string;
      setCookies: Indexable;
      removeCookies: Indexable;
    }
  | Indexable
  | string;

export type SetConfigRequest = GrpcRequest<{ newConfig: string }>;
export type SetConfigResponse = GrpcResponse<{ updatedConfig: string }>;

export type ParsedSocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: any[];
  context: Context;
}>;

type EventResponse = {
  event: string;
  data: Indexable;
  receivers?: string[];
};

type JoinRoomResponse = {
  rooms: string[];
};
export type UnparsedSocketResponse = EventResponse | JoinRoomResponse;

export enum HealthCheckStatus {
  UNKNOWN,
  SERVING,
  NOT_SERVING,
  SERVICE_UNKNOWN,
}

export type MetricConfiguration =
  | CounterConfiguration<any>
  | SummaryConfiguration<any>
  | HistogramConfiguration<any>
  | GaugeConfiguration<any>;

export enum MetricType {
  Counter,
  Gauge,
  Histogram,
  Summary,
}
