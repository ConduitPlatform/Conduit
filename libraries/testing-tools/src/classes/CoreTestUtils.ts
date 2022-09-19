import { TestUtils } from './TestUtils';
import { ConfigDefinition } from '@conduitplatform/grpc-sdk/src/protoUtils/core';
import { exec, ExecOptions } from 'child_process';

export class CoreTestUtils extends TestUtils<ConfigDefinition> {
  constructor() {
    super();
  }

  async startCore() {
    const options: ExecOptions = {
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
    this._client = this.createClient(ConfigDefinition);
    return coreProcess;
  }
}
