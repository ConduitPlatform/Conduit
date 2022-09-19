import TestingTools from '@conduitplatform/testing-tools';
import { ConfigDefinition } from '@conduitplatform/commons';
import path from 'path';
let coreProcess: any, testModule: any;
const testModuleUrl = '0.0.0.0:55184';

const testTools = new TestingTools<ConfigDefinition>('0.0.0.0:55152', ConfigDefinition);
beforeAll(async () => {
  await testTools.baseSetup();
  await testTools.runDependencies([
    {
      command: 'node ' + path.resolve(__dirname, '../../dist/bin/www.js'),
      options: {
        env: {
          REDIS_PORT: '6379',
          REDIS_HOST: 'localhost',
          PORT: '3030',
          ADMIN_SOCKET_PORT: '3032',
          process_env: process.env,
        },
      },
      delay: 8000,
    },
  ]);
});

describe('Testing Core package', () => {
  test('Getting Redis Details', async () => {
    try {
      const res = await testTools.client.getRedisDetails({});
      expect(res).toMatchObject({
        redisPort: expect.any(Number),
        redisHost: expect.any(String),
      });
    } catch (e) {
      expect(e).toMatch('error');
    }
  });

  test('Getting Server Config', async () => {
    const res = await testTools.client.getServerConfig({});
    try {
      expect(res).toMatchObject({
        data: expect.any(String),
      });
    } catch (e) {
      expect(e).toMatch('error');
    }
  });
});

describe('Testing module related rpc calls', () => {
  test('Register Module', async () => {
    const res = await testTools.client.registerModule({
      moduleName: 'test',
      url: '0.0.0.0:55122',
      healthStatus: 1,
    });
    try {
      expect(res).toMatchObject({
        result: expect.any(Boolean),
      });
    } catch (e) {
      throw e;
    }
  });
  test('Getting Module List', async () => {
    const res = await testTools.client.moduleList({});
    try {
      expect(res.modules[0]).toMatchObject({
        moduleName: 'test',
        url: testModuleUrl,
        serving: expect.any(Boolean),
      });
    } catch (e) {
      throw e;
    }
  });
  //
  // test('Module Exists', async () => {
  //   const res = await client.moduleExists({ moduleName: 'test' });
  //   try {
  //     expect(res).toMatchObject({
  //       url: testModuleUrl,
  //     });
  //   } catch (e) {
  //     expect(e).toMatch('error');
  //   }
  // });
  //
  // test('Get Module Url By Name', async () => {
  //   const res = await client.getModuleUrlByName({ name: 'test' });
  //   try {
  //     expect(res).toMatchObject({
  //       moduleUrl: testModuleUrl,
  //     });
  //   } catch (e) {
  //     expect(e).toMatch('error');
  //   }
  // });
  //
  // test('Get Config Request', async () => {
  //   const res = await client.get({ key: 'test' });
  //   try {
  //     expect(res).toMatchObject({
  //       data: expect.any(String),
  //     });
  //   } catch (e) {
  //     expect(e).toMatch('error');
  //   }
  // });
  //
  // test('Configure', async () => {
  //   const res = await client.configure({
  //     config: JSON.stringify({ active: false, mockField: 'some field' }),
  //     schema: JSON.stringify({
  //       active: { format: 'Boolean', default: true },
  //       mockField: { format: 'String', default: '' },
  //     }),
  //   });
  //   try {
  //     expect(res).toMatchObject({
  //       result: expect.any(String),
  //     });
  //   } catch (e) {
  //     expect(e).toMatch('error');
  //   }
  // });
});

afterAll(async () => {
  process.kill(coreProcess.pid);
  process.kill(testModule.pid);
  await testTools.stopRedis();
});
