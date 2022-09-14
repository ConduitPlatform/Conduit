#!/usr/bin/env node

import { Core } from '../Core';
import { isNaN } from 'lodash';

bootstrap();

function bootstrap() {
  const grpcPort = getGrpcPort();
  Core.getInstance(grpcPort);
}

function getGrpcPort() {
  const value = process.env['GRPC_PORT'] ?? '55152';
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 0) {
    throw new Error(`Invalid gRPC port value: ${port}`);
  }
  return port;
}
