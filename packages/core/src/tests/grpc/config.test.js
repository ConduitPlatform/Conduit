let coreProcess,client,testModule;
beforeAll(async () => {
  const { exec } = require('child_process');
  let options = {
    env: { ...process.env, REDIS_PORT: 6379, REDIS_HOST: 'localhost', PORT: 3030, ADMIN_SOCKET_PORT: 3032 },
  };
  exec('sh ./src/tests/scripts/redis.sh');
  await new Promise((r) => setTimeout(r, 2000));
  exec('cp ./src/tests/mocks/test.proto ./dist/tests/mocks/module')
  await new Promise((r) => setTimeout(r, 3000))
  coreProcess = exec('node ./dist/bin/www.js', options);
  await new Promise((r) => setTimeout(r, 5000));
  options = {
    env: {
      CONDUIT_SERVER: '0.0.0.0:55152', SERVICE_IP: '0.0.0.0:55184'
    }
  }
  testModule = exec('node ./dist/tests/mocks/module/index.js',options);
  await new Promise((r) => setTimeout(r, 5000));
  const path = require('path');
  const protoLoader = require('@grpc/proto-loader');
  const grpc = require('@grpc/grpc-js');
  const current_path = path.join(__dirname, '..', '..', '/core.proto');
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


describe('Testing Config package', () => {
  test('Getting Redis Details', () => {
    client.getRedisDetails({}, (err, res) => {
      expect(res).toMatchObject({
        redisHost: expect.any(String),
        redisPort: expect.any(Number),
      });
    });
  });

  test('Getting Server Config', () => {
    client.getServerConfig({}, (err, res) => {
      expect(res).toMatchObject({
        data: expect.any(String),
      });
    });
  });

  test('Getting Module List', () => {
    client.moduleList({}, (err, res) => {

    });
  });

});