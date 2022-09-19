import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { getModuleNameInterceptor } from '@conduitplatform/grpc-sdk/dist/interceptors';
import { createChannel, createClientFactory } from 'nice-grpc';
const { exec } = require('child_process');

export default class TestingTools {
  private readonly _grpcSdk: ConduitGrpcSdk;

  constructor() {}

  async startRedis() {
    exec('docker run --name conduit-redis -d -p 6379:6379 redis:latest');
    await new Promise(r => setTimeout(r, 3000));
  }

  async stopRedis() {
    exec('docker stop conduit-redis && docker rm conduit-redis');
    await new Promise(r => setTimeout(r, 3000));
  }

  async startCore() {
    const options = {
      env: {
        REDIS_PORT: 6379,
        REDIS_HOST: 'localhost',
        PORT: 3030,
        ADMIN_SOCKET_PORT: 3032,
        ...process.env,
      },
      cwd: './',
    };
    const coreProcess = exec('node ../../packages/core/dist/bin/www.js', options);
    await new Promise(r => setTimeout(r, 8000));
    return coreProcess;
  }

  createClient(serviceDefinition: any) {
    const channel = createChannel('0.0.0.0:55152', undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const clientFactory = createClientFactory().use(getModuleNameInterceptor('test'));
    return clientFactory.create(serviceDefinition, channel);
  }
}
