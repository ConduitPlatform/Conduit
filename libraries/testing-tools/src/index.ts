import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Client, createChannel, createClientFactory } from 'nice-grpc';
import { getModuleNameInterceptor } from '@conduitplatform/grpc-sdk/dist/interceptors';
import { IRRunDependenciesInterface } from './interfaces/IRRunDependenciesInterface';

const { exec } = require('child_process');

export default class TestingTools<T extends CompatServiceDefinition> {
  _client: Client<T>;

  constructor(private readonly serverAddress: string, serviceDefinition: T) {
    const channel = createChannel(this.serverAddress, undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const clientFactory = createClientFactory().use(getModuleNameInterceptor('test'));
    this._client = clientFactory.create(serviceDefinition, channel);
  }

  async startRedis() {
    exec('docker run --name conduit-redis -d -p 6379:6379 redis:latest');
    await new Promise(r => setTimeout(r, 3000));
  }

  async stopRedis() {
    exec('docker stop conduit-redis && docker rm conduit-redis');
    await new Promise(r => setTimeout(r, 3000));
  }

  async runDependencies(dependencies: IRRunDependenciesInterface[]) {
    for (let dependency of dependencies) {
      exec(dependency.command, dependency.options);
      await new Promise(r => setTimeout(r, dependency.delay));
    }
  }

  async baseSetup() {
    await this.stopRedis();
    await this.startRedis();
  }

  get client() {
    return this._client;
  }
}
