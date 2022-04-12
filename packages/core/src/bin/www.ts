#!/usr/bin/env node

import { Core } from '../Core';
import { isNaN } from 'lodash';

bootstrap();

function bootstrap() {
  const httpPort = getHttpPort();
  const grpcPort = getGrpcPort();
  Core.getInstance(httpPort, grpcPort);
}

function getHttpPort() {
  const value = process.env['PORT'] ?? '3000';
  const port = parseInt(value, 10);
  if (isNaN(port)) {
    return value; // named pipe
  }
  if (port >= 0) {
    return port;
  }
  throw new Error(`Invalid HTTP port value: ${port}`);
}

function getGrpcPort() {
  const value = process.env['SERVICE_PORT'] ?? '55152';
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 0) {
    throw new Error(`Invalid gRPC port value: ${port}`);
  }
  return port;
}
