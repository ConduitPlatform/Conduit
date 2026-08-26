/**
 * Shared npm externals for Conduit service bundles.
 * Kept in sync with grpc-sdk / module-tools runtime deps; bundle manifest deps must match 1:1.
 */
export const SHARED_BUNDLE_EXTERNALS = [
  '@bufbuild/protobuf',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  '@sesamecare-oss/redlock',
  'abort-controller-x',
  'axios',
  'convict',
  'escape-string-regexp',
  'express',
  'fast-jwt',
  'fs-extra',
  'ioredis',
  'lodash',
  'lodash-es',
  'nice-grpc',
  'nice-grpc-client-middleware-retry',
  'nice-grpc-common',
  'prom-client',
  'protobufjs',
  'snappy',
  'uuid',
  'winston',
  'winston-loki',
] as const;

export type SharedBundleExternal = (typeof SHARED_BUNDLE_EXTERNALS)[number];
