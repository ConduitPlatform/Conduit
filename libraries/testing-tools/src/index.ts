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
  const redisPort = process.env.REDIS_PORT ?? '6379';
  exec(`docker run --name conduit-redis-tests -d -p ${redisPort}:6379 redis:latest`);
  await new Promise(r => setTimeout(r, 3000));
}

export async function stopRedis() {
  exec('docker stop conduit-redis-tests && docker rm conduit-redis-tests');
  await new Promise(r => setTimeout(r, 3000));
}

export async function startMongo() {
  const mongoPort = process.env.MONGO_PORT ?? '27017';
  exec(`docker run --name conduit-mongo-tests -d -p ${mongoPort}:27017 mongo`);
  await new Promise(r => setTimeout(r, 3000));
}

export async function stopMongo() {
  exec('docker stop conduit-mongo-tests && docker rm conduit-mongo-tests');
  await new Promise(r => setTimeout(r, 3000));
}

export async function runDependencies(dependencies: IRunDependenciesInterface[]) {
  const processes: ChildProcess[] = [];
  for (const dependency of dependencies) {
    const process = exec(dependency.command, dependency.ExecOptions);
    processes.push(process);
    await new Promise(r => setTimeout(r, dependency.delay));
  }
  return processes;
}

export async function baseSetup() {
  await stopRedis();
  await startRedis();
  await stopMongo();
  await startMongo();
}
