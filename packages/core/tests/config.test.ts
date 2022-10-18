import * as testingTools from '@conduitplatform/testing-tools';
import { ConfigDefinition } from '@conduitplatform/commons';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { sleep } from '@conduitplatform/grpc-sdk/src/utilities';

const testModuleUrl = '0.0.0.0:55184';
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

describe('Testing Core package', () => {
  test('Getting Redis Details', async () => {
    const res = await testClient.getRedisDetails({});
    expect(res).toMatchObject({
      redisPort: expect.any(Number),
      redisHost: expect.any(String),
    });
  });

  test('Getting Server Config', async () => {
    const res = await testClient.getServerConfig({});
    expect(res).toMatchObject({
      data: expect.any(String),
    });
  });
});

describe('Testing module related rpc calls', () => {
  test('Register Module', async () => {
    const res = await testClient.registerModule({
      moduleName: 'test',
      url: testModuleUrl,
      healthStatus: 1,
    });
    expect(res).toMatchObject({
      result: expect.any(Boolean),
    });
  });

  test('Getting Module List', async () => {
    const res = await testClient.moduleList({});
    expect(res.modules[0]).toMatchObject({
      moduleName: 'test',
      url: testModuleUrl,
      serving: expect.any(Boolean),
    });
  });

  test('Module Exists', async () => {
    const res = await testClient.moduleExists({ moduleName: 'test' });
    expect(res).toMatchObject({
      url: testModuleUrl,
    });
  });

  test('Get Module Url By Name', async () => {
    const res = await testClient.getModuleUrlByName({ name: 'test' });
    expect(res).toMatchObject({
      moduleUrl: testModuleUrl,
    });
  });

  test('Get Config Request', async () => {
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

  test('Module Health Probe', async () => {
    const res = await testClient.moduleHealthProbe({
      moduleName: 'test',
      url: testModuleUrl,
      status: 1,
    });
    expect(res).toMatchObject({});
  });

  test('Watch Modules', async () => {
    const watchModules = testClient.watchModules({});
    sleep(6000).then(async () => {
      await testClient.registerModule({
        moduleName: 'watch-modules',
        url: '0.0.0.0:55152',
        healthStatus: 1,
      });
      for await (const modules of watchModules) {
        expect(modules).toMatchObject({
          modules: [
            { moduleName: 'test', url: '0.0.0.0:55184', serving: true },
            { moduleName: 'watch-modules', url: '0.0.0.0:55152', serving: true },
          ],
        });
        break;
      }
    });
  });
});

afterAll(async () => {
  dependencies.forEach(dependency => {
    process.kill(dependency.pid);
  });
  await testingTools.stopRedis();
});
