import { TestUtils } from './TestUtils';
import { ConfigDefinition } from '@conduitplatform/grpc-sdk/src/protoUtils/core';
const { exec } = require('child_process');

export class CoreTestUtils extends TestUtils<ConfigDefinition> {
  constructor() {
    super();
  }

  async startCore() {
    const options = {
      env: {
        REDIS_PORT: '6379',
        REDIS_HOST: 'localhost',
        PORT: '3030',
        ADMIN_SOCKET_PORT: '3032',
        ...process.env,
      },
      cwd: './',
    };
    const coreProcess = exec('node ../../packages/core/dist/bin/www.js', options);
    await new Promise(r => setTimeout(r, 8000));
    await this.createClient(ConfigDefinition);
    return coreProcess;
  }

  async testRegisterModule() {
    return this.client.registerModule({
      moduleName: 'test',
      url: '0.0.0.0:55185',
      healthStatus: 1,
    });
  }
}
