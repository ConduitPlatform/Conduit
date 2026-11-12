export function assertGrpcKeyRequirement(env: NodeJS.ProcessEnv = process.env): void {
  const required = env.NODE_ENV === 'production';
  if (required && !env.GRPC_KEY) {
    // startup / config guard, not a request error
    throw new Error('GRPC_KEY is required for embeddings in production');
  }
}

export function callerModuleName(metadata?: {
  get(key: string): Array<string | Buffer>;
}): string | undefined {
  const value = metadata?.get('module-name')?.[0];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Buffer.isBuffer(value) && value.length > 0) return value.toString();
  return undefined;
}
