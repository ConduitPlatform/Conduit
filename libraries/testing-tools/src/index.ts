import { CoreTestUtils } from './classes/CoreTestUtils';
const { exec } = require('child_process');

export default class TestingTools {
  coreTestUtils: CoreTestUtils;
  constructor() {
    this.coreTestUtils = new CoreTestUtils();
  }

  async startRedis() {
    exec('docker run --name conduit-redis -d -p 6379:6379 redis:latest');
    await new Promise(r => setTimeout(r, 3000));
  }

  async stopRedis() {
    exec('docker stop conduit-redis && docker rm conduit-redis');
    await new Promise(r => setTimeout(r, 3000));
  }

  async baseSetup() {
    await this.stopRedis();
    await this.startRedis();
    await this.coreTestUtils.startCore();
  }

  get coreClient() {
    return this.coreTestUtils.client;
  }
}
