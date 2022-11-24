import * as testingTools from '@conduitplatform/testing-tools';
import { ConfigDefinition } from '@conduitplatform/commons';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { sleep } from '@conduitplatform/grpc-sdk/src/utilities';

const REGISTER_MODULE_SERVICE_URL = '0.0.0.0:55184';
const WATCH_DEPLOYMENT_STATE_SERVICE_URL = '0.0.0.0:55185';

let dependencies: ChildProcess[];
const testModule = testingTools.getTestModule<ConfigDefinition>(
  'test',
  '0.0.0.0:55152',
  ConfigDefinition,
);
const testClient = testModule.getModuleClient('test', ConfigDefinition);

beforeAll(async () => {
  await testingTools.baseSetup();
  dependencies = await testingTools.runDependencies([
    {
      command: 'node ' + path.resolve(__dirname, '../dist/bin/www.js'),
      ExecOptions: {
        env: {
          REDIS_PORT: 6379,
          REDIS_HOST: 'localhost',
          PORT: 3030,
          ADMIN_SOCKET_PORT: 3032,
          ...process.env,
        },
      },
      delay: 8000,
    },
  ]);
});

describe('Testing Config Service', () => {
  test('GetConfigRequest', async () => {
    await testClient.configure({
      config: JSON.stringify({ active: false }),
      schema: JSON.stringify({
        active: { format: 'Boolean', default: true },
      }),
    });
    const res = await testClient.get({ key: 'test' });
    expect(res).toMatchObject({
      data: expect.any(String),
    });
  });

  test('Configure', async () => {
    const res = await testClient.configure({
      config: JSON.stringify({ active: false, mockField: 'some field' }),
      schema: JSON.stringify({
        active: { format: 'Boolean', default: true },
        mockField: { format: 'String', default: '' },
      }),
    });
    expect(res).toMatchObject({
      result: expect.any(String),
    });
  });

  test('GetDeploymentState', async () => {
    const res = await testClient.getDeploymentState({});
    expect(res).toMatchObject({
      modules: [
        {
          moduleName: 'core',
          moduleVersion: expect.any(String),
          moduleUrl: expect.any(String),
          pending: false,
          serving: expect.any(Boolean),
        },
      ],
    });
  });

  test('RegisterModule', async () => {
    const res = await testClient.registerModule({
      manifest: {
        moduleName: 'test-register-module',
        moduleVersion: '0.16.0',
        dependencies: [
          {
            name: 'some-unavailable-module',
            version: '^0.16',
          },
        ],
      },
      url: REGISTER_MODULE_SERVICE_URL,
      healthStatus: 1,
    });
    expect(res).toMatchObject({});
  });

  test('WatchDeploymentState', async () => {
    const watchDeploymentState = testClient.watchDeploymentState({});
    await sleep(6000).then(async () => {
      await testClient.registerModule({
        manifest: {
          moduleName: 'test-watch-deployment-state',
          moduleVersion: '0.16.0',
          dependencies: [
            {
              name: 'test',
              version: '0.16.0',
            },
          ],
        },
        url: WATCH_DEPLOYMENT_STATE_SERVICE_URL,
        healthStatus: 1,
      });
      for await (const modules of watchDeploymentState) {
        expect(modules).toMatchObject({
          modules: [
            {
              moduleName: 'core',
              moduleVersion: expect.any(String),
              moduleUrl: expect.any(String),
              pending: false,
              serving: true,
            },
            {
              moduleName: 'test-register-module',
              moduleVersion: '0.16.0',
              moduleUrl: REGISTER_MODULE_SERVICE_URL,
              pending: expect.any(Boolean),
              serving: true,
            },
            {
              moduleName: 'test-watch-deployment-state',
              moduleVersion: '0.16.0',
              moduleUrl: WATCH_DEPLOYMENT_STATE_SERVICE_URL,
              pending: expect.any(Boolean),
              serving: true,
            },
          ],
        });
        break;
      }
    });
  });

  test('ModuleHealthProbe', async () => {
    const res = await testClient.moduleHealthProbe({
      moduleName: 'test-register-module',
      moduleVersion: 'v0.16.0',
      moduleUrl: REGISTER_MODULE_SERVICE_URL,
      status: 1,
    });
    expect(res).toMatchObject({});
  });

  test('GetRedisDetails', async () => {
    const res = await testClient.getRedisDetails({});
    expect(res).toMatchObject({
      redisPort: expect.any(Number),
      redisHost: expect.any(String),
    });
  });

  test('GetServerConfig', async () => {
    const res = await testClient.getServerConfig({});
    expect(res).toMatchObject({
      data: expect.any(String),
    });
  });

  test('GetModuleUrlByName', async () => {
    const res = await testClient.getModuleUrlByName({ name: 'test-register-module' });
    expect(res).toMatchObject({
      moduleUrl: REGISTER_MODULE_SERVICE_URL,
    });
  });
});

afterAll(async () => {
  dependencies.forEach(dependency => {
    process.kill(dependency.pid);
  });
  await testingTools.stopRedis();
});
