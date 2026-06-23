import type { ReadinessConfig } from './types.js';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function loadReadinessConfig(): ReadinessConfig {
  const requiredModules = (process.env.READY_REQUIRED_MODULES ?? '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

  return {
    requiredModules,
    checkRedis: parseBoolean(process.env.READY_CHECK_REDIS, true),
    strict: parseBoolean(process.env.READY_STRICT, false),
    probeModulesActive: parseBoolean(process.env.READY_PROBE_MODULES_ACTIVE, false),
    totalTimeoutMs: parsePositiveInt(process.env.READY_TOTAL_TIMEOUT_MS, 3000),
    redisTimeoutMs: parsePositiveInt(process.env.READY_REDIS_TIMEOUT_MS, 500),
    moduleTimeoutMs: parsePositiveInt(process.env.READY_MODULE_TIMEOUT_MS, 1000),
  };
}
