export type ReadinessCheckStatus = 'pass' | 'fail' | 'warn';

export type ReadinessCheck = {
  name: string;
  status: ReadinessCheckStatus;
  message?: string;
  latencyMs?: number;
};

export type ReadinessReport = {
  status: 'ready' | 'not_ready';
  message: string;
  checks: ReadinessCheck[];
  timestamp: string;
};

export interface CoreHealthProvider {
  readonly initialized: boolean;
  isGrpcServing(): boolean;
}

export type ReadinessConfig = {
  requiredModules: string[];
  checkRedis: boolean;
  strict: boolean;
  probeModulesActive: boolean;
  totalTimeoutMs: number;
  redisTimeoutMs: number;
  moduleTimeoutMs: number;
};
