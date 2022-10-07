import MockModule from './mock-module';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { ChildProcess, exec } from 'child_process';
import { IRunDependenciesInterface } from './interfaces/IRunDependenciesInterface';

export function getTestModule<T extends CompatServiceDefinition>(
  moduleName: string,
  serverAddress: string,
  serviceDefinition: T,
) {
  return new MockModule<T>(moduleName, serverAddress, serviceDefinition);
}

export async function startRedis() {
  exec('docker run --name conduit-redis -d -p 6379:6379 redis:latest');
  await new Promise(r => setTimeout(r, 3000));
}

export async function stopRedis() {
  exec('docker stop conduit-redis && docker rm conduit-redis');
  await new Promise(r => setTimeout(r, 3000));
}

export async function runDependencies(dependencies: IRunDependenciesInterface[]) {
  const processes: ChildProcess[] = [];
  for (const dependency of dependencies) {
    const process = exec(dependency.command, dependency.options);
    processes.push(process);
    await new Promise(r => setTimeout(r, dependency.delay));
  }
  return processes;
}

export async function baseSetup() {
  await stopRedis();
  await startRedis();
}
