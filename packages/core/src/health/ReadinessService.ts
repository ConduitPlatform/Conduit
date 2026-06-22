import {
  ConduitGrpcSdk,
  HealthCheckResponse,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import { ServiceRegistry } from '../service-discovery/ServiceRegistry.js';
import type {
  CoreHealthProvider,
  ReadinessCheck,
  ReadinessConfig,
  ReadinessReport,
} from './types.js';

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class ReadinessService {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly coreHealth: CoreHealthProvider,
    private readonly config: ReadinessConfig,
  ) {}

  async evaluate(): Promise<ReadinessReport> {
    const deadline = Date.now() + this.config.totalTimeoutMs;
    const checks: ReadinessCheck[] = [];

    const remainingMs = () => Math.max(1, deadline - Date.now());

    checks.push(this.checkCoreInitialized());
    checks.push(this.checkCoreGrpc());

    if (this.config.checkRedis) {
      checks.push(
        await this.checkRedis(Math.min(this.config.redisTimeoutMs, remainingMs())),
      );
    }

    const moduleChecks = await this.checkModules(remainingMs);
    checks.push(...moduleChecks);

    const hasFailure = checks.some(check => check.status === 'fail');
    const status = hasFailure ? 'not_ready' : 'ready';

    return {
      status,
      message: status === 'ready' ? 'Conduit Core is ready' : 'Conduit Core is not ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private checkCoreInitialized(): ReadinessCheck {
    const start = Date.now();
    const pass = this.coreHealth.initialized;
    return {
      name: 'core.initialized',
      status: pass ? 'pass' : 'fail',
      message: pass ? undefined : 'Core bootstrap incomplete',
      latencyMs: Date.now() - start,
    };
  }

  private checkCoreGrpc(): ReadinessCheck {
    const start = Date.now();
    const pass = this.coreHealth.isGrpcServing();
    return {
      name: 'core.grpc',
      status: pass ? 'pass' : 'fail',
      message: pass ? undefined : 'gRPC health is not SERVING',
      latencyMs: Date.now() - start,
    };
  }

  private async checkRedis(timeoutMs: number): Promise<ReadinessCheck> {
    const start = Date.now();
    try {
      const client = this.grpcSdk.redisManager.getClient();
      const pong = await withTimeout(client.ping(), timeoutMs, 'Redis PING');
      if (pong !== 'PONG') {
        return {
          name: 'redis',
          status: 'fail',
          message: `Unexpected PING response: ${String(pong)}`,
          latencyMs: Date.now() - start,
        };
      }
      return {
        name: 'redis',
        status: 'pass',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: 'redis',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Redis check failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkModules(remainingMs: () => number): Promise<ReadinessCheck[]> {
    const registry = ServiceRegistry.getInstance();
    const registered = new Map(
      registry.getModuleDetailsList().map(module => [module.moduleName, module]),
    );
    const required = new Set(this.config.requiredModules);
    const checks: ReadinessCheck[] = [];

    for (const moduleName of required) {
      checks.push(
        await this.checkRequiredModule(
          moduleName,
          registered.get(moduleName),
          remainingMs,
        ),
      );
    }

    for (const module of registered.values()) {
      if (required.has(module.moduleName)) continue;
      checks.push(await this.checkOptionalModule(module.moduleName, module, remainingMs));
    }

    return checks;
  }

  private async checkRequiredModule(
    moduleName: string,
    module:
      | {
          moduleName: string;
          url: string;
          serving: boolean;
        }
      | undefined,
    remainingMs: () => number,
  ): Promise<ReadinessCheck> {
    const start = Date.now();
    if (!module) {
      return {
        name: `modules.${moduleName}`,
        status: 'fail',
        message: 'not registered',
        latencyMs: Date.now() - start,
      };
    }

    if (this.config.probeModulesActive) {
      const active = await this.probeModuleHealth(
        moduleName,
        Math.min(this.config.moduleTimeoutMs, remainingMs()),
      );
      if (!active) {
        return {
          name: `modules.${moduleName}`,
          status: 'fail',
          message: 'health check failed',
          latencyMs: Date.now() - start,
        };
      }
    } else if (!module.serving) {
      return {
        name: `modules.${moduleName}`,
        status: 'fail',
        message: 'not serving',
        latencyMs: Date.now() - start,
      };
    }

    return {
      name: `modules.${moduleName}`,
      status: 'pass',
      latencyMs: Date.now() - start,
    };
  }

  private async checkOptionalModule(
    moduleName: string,
    module: { moduleName: string; url: string; serving: boolean },
    remainingMs: () => number,
  ): Promise<ReadinessCheck> {
    const start = Date.now();
    let serving = module.serving;

    if (this.config.probeModulesActive) {
      serving = await this.probeModuleHealth(
        moduleName,
        Math.min(this.config.moduleTimeoutMs, remainingMs()),
      );
    }

    if (!serving) {
      const status = this.config.strict ? 'fail' : 'warn';
      return {
        name: `modules.${moduleName}`,
        status,
        message: 'not serving',
        latencyMs: Date.now() - start,
      };
    }

    return {
      name: `modules.${moduleName}`,
      status: 'pass',
      latencyMs: Date.now() - start,
    };
  }

  private async probeModuleHealth(
    moduleName: string,
    timeoutMs: number,
  ): Promise<boolean> {
    const healthClient = this.grpcSdk.getHealthClient(moduleName);
    if (!healthClient) return true;

    try {
      const response = await withTimeout(
        healthClient.check({}) as Promise<HealthCheckResponse>,
        timeoutMs,
        `Module ${moduleName} health`,
      );
      return (
        (response.status as unknown as HealthCheckStatus) === HealthCheckStatus.SERVING
      );
    } catch {
      return false;
    }
  }
}
