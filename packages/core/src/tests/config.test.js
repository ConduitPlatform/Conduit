let coreProcess,client,testModule;
const path = require('path');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const { exec } = require('child_process');
beforeAll(async () => {
  let options = {
    env: { ...process.env, REDIS_PORT: 6379, REDIS_HOST: 'localhost', PORT: 3030, ADMIN_SOCKET_PORT: 3032 },
    cwd: './'
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

// afterAll( () => {
//   process.kill(coreProcess.pid)
//   process.kill(testModule.pid)
// })


describe('Testing Core package', () => {
  test('Getting Redis Details', () => {
    client.getRedisDetails({}, (err, res) => {
      return expect(res).toMatchObject({
        redisHost: expect.any(String),
        redisPort: expect.any(Number),
      });
    });
  });

  test('Getting Server Config', () => {
    client.getServerConfig({}, (err, res) => {
      return expect(res).toMatchObject({
        data: expect.any(String),
      });
    });
  });
});

describe('Testing module related rpc calls', () => {
  beforeAll(async () => {
    let testOptions = {
      env: { ...process.env , SERVICE_IP: '0.0.0.0:55184', CONDUIT_SERVER: '0.0.0.0:55152' }
    }
    testModule = exec('node ./dist/tests/mocks/module/index.js', testOptions);
    await new Promise((r) => setTimeout(r, 10000));
  })

  test('Getting Module List', done => {
     client.moduleList({}, async (err, res) => {
       expect(res.modules).toMatchObject({
        name: 'test',
        url: '0.0.0.0:55184',
        serving: true,
      });
       done()
    });
  })

})