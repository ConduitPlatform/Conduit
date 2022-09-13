import {
  GetConfigResponse,
  GetRedisDetailsResponse,
  ModuleByNameResponse,
  ModuleExistsResponse,
  ModuleListResponse,
  UpdateResponse,
} from '@conduitplatform/commons';

let coreProcess: any, client: any, testModule: any;
import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { EventEmitter } from 'events';

const { exec } = require('child_process');

const testModuleUrl = '0.0.0.0:55184';

let eventEmitter;
beforeAll(async () => {
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
  exec('sh ./src/tests/scripts/setup.sh');
  await new Promise(r => setTimeout(r, 5000));
  coreProcess = exec('node ./dist/bin/www.js', options);
  await new Promise(r => setTimeout(r, 8000));

  const current_path = path.join(__dirname, '..', '..', '/src/core.proto');
  const packageDefinition = protoLoader.loadSync(current_path, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  //@ts-ignore
  const core = grpc.loadPackageDefinition(packageDefinition).conduit.core;
  client = new core.Config('0.0.0.0:55152', grpc.credentials.createInsecure());

  eventEmitter = new EventEmitter();
});

describe('Testing Core package', () => {
  test('Getting Redis Details', done => {
    client.getRedisDetails({}, (err: Error, res: GetRedisDetailsResponse) => {
      if (err) {
        done(err);
      }
      try {
        expect(res).toMatchObject({
          redisHost: expect.any(String),
          redisPort: expect.any(Number),
        });
        done();
      } catch (e) {
        done((e as Error).message);
      }
    });
  });

  test('Getting Server Config', done => {
    client.getServerConfig({}, (err: Error, res: GetConfigResponse) => {
      if (err) done(err);
      try {
        expect(res).toMatchObject({
          data: expect.any(String),
        });
        done();
      } catch (e) {
        done((e as Error).message);
      }
    });
  });
});

describe('Testing module related rpc calls', () => {
  beforeAll(async () => {
    const testOptions = {
      env: { SERVICE_IP: testModuleUrl, CONDUIT_SERVER: '0.0.0.0:55152', ...process.env },
    };
    testModule = exec('node ./dist/tests/mocks/module/index.js', testOptions);
    await new Promise(r => setTimeout(r, 10000));
  });

  test('Getting Module List', done => {
    client.moduleList({}, async (err: Error, res: ModuleListResponse) => {
      if (err) done(err);
      try {
        expect(res.modules[0]).toMatchObject({
          moduleName: 'test',
          url: testModuleUrl,
          serving: expect.any(Boolean),
        });
        done();
      } catch (e) {
        done((e as Error).message);
      }
    });
  });

  test('Module Exists', done => {
    client.moduleExists(
      { moduleName: 'test' },
      async (err: Error, res: ModuleExistsResponse) => {
        if (err) done(err);
        try {
          expect(res).toMatchObject({
            url: testModuleUrl,
          });
          done();
        } catch (e) {
          done((e as Error).message);
        }
      },
    );
  });

  test('Get Module Url By Name', done => {
    client.getModuleUrlByName(
      { name: 'test' },
      async (err: Error, res: ModuleByNameResponse) => {
        if (err) done(err);
        try {
          expect(res).toMatchObject({
            moduleUrl: testModuleUrl,
          });
          done();
        } catch (e) {
          done((e as Error).message);
        }
      },
    );
  });
  test('Get Config Request', done => {
    client.get({ key: 'test' }, (err: Error, res: GetConfigResponse) => {
      if (err) done(err);
      try {
        expect(res).toMatchObject({
          data: expect.any(String),
        });
        done();
      } catch (e) {
        done((e as Error).message);
      }
    });
  });

  test('Update Config Request', done => {
    client.updateConfig(
      {
        config: JSON.stringify({ active: false }),
        schema: 'test',
      },
      (err: Error, res: UpdateResponse) => {
        if (err) done(err);
        try {
          expect(res).toMatchObject({
            result: expect.any(String),
          });
          done();
        } catch (e) {
          done((e as Error).message);
        }
      },
    );
  });
});

afterAll(() => {
  process.kill(coreProcess.pid);
  process.kill(testModule.pid);
  exec('docker stop conduit-redis');
});
