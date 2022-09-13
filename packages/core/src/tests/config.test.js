let coreProcess, client, testModule;
const path = require('path');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const { exec } = require('child_process');
beforeAll(async () => {
  let options = {
    env: { REDIS_PORT: 6379, REDIS_HOST: 'localhost', PORT: 3030, ADMIN_SOCKET_PORT: 3032, ...process.env },
    cwd: './',
  };
  exec('sh ./src/tests/scripts/setup.sh');
  await new Promise((r) => setTimeout(r, 5000));
 coreProcess = exec('node ./dist/bin/www.js', options);
 await new Promise((r) => setTimeout(r, 8000));

  const current_path = path.join(__dirname, '..', '..', '/src/core.proto');
  const packageDefinition = protoLoader.loadSync(
    current_path,
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
  const core = grpc.loadPackageDefinition(packageDefinition).conduit.core;
  client = new core.Config('0.0.0.0:55152',
    grpc.credentials.createInsecure());
});

describe('Testing Core package', () => {
  test('Getting Redis Details', done => {
    client.getRedisDetails({}, (err, res) => {
      try {
        expect(res).toMatchObject({
          redisHost: expect.any(String),
          redisPort: expect.any(Number),
        });
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  test('Getting Server Config', done => {
    client.getServerConfig({}, (err, res) => {
      try {
        expect(res).toMatchObject({
          data: expect.any(String),
        });
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});

describe('Testing module related rpc calls', () => {
  beforeAll(async () => {
    let testOptions = {
      env: { SERVICE_IP: '0.0.0.0:55184', CONDUIT_SERVER: '0.0.0.0:55152', ...process.env },
    };
    testModule = exec('node ./dist/tests/mocks/module/index.js', testOptions);
    await new Promise((r) => setTimeout(r, 10000));
  });

  test('Getting Module List', done => {
    client.moduleList({}, async (err, res) => {
      try {
        expect(res.modules[0]).toMatchObject({
          moduleName: 'test',
          url: expect.any(String),
          serving: expect.any(Boolean),
        });
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  test('Module Exists', done => {
    client.moduleExists({ moduleName: 'test'}, async (err, res) => {
      try {
        expect(res).toMatchObject({
         url: expect.any(String)
        });
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});

afterAll(() => {
  process.kill(coreProcess.pid);
  process.kill(testModule.pid);
  exec('docker stop conduit-redis');
});
