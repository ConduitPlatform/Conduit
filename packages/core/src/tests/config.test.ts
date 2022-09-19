import TestingTools from '@conduitplatform/testing-tools';

let coreProcess: any, client: any, testModule: any;
const testModuleUrl = '0.0.0.0:55184';

const testTools = new TestingTools();
beforeAll(async () => {
  await testTools.baseSetup();
  client = testTools.coreClient;
});

describe('Testing Core package', () => {
  test('Getting Redis Details', async () => {
    try {
      const res = await client.getRedisDetails({});
      expect(res).toMatchObject({
        redisPort: expect.any(Number),
        redisHost: expect.any(String),
      });
    } catch (e) {
      expect(e).toMatch('error');
    }
  });

  test('Getting Server Config', async () => {
    const res = await client.getServerConfig({});
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
    const res = await testTools.coreTestUtils.testRegisterModule();
    try {
      expect(res).toMatchObject({
        result: expect.any(Boolean),
      });
    } catch (e) {
      throw e;
    }
  });
  // test('Getting Module List', async () => {
  //   const res = await client.moduleList({});
  //   try {
  //     expect(res.modules[0]).toMatchObject({
  //       moduleName: 'test',
  //       url: testModuleUrl,
  //       serving: expect.any(Boolean),
  //     });
  //   } catch (e) {
  //     expect(e).toMatch('error');
  //   }
  // });
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

afterAll(() => {
  process.kill(coreProcess.pid);
  process.kill(testModule.pid);
  exec('docker stop conduit-redis');
});
