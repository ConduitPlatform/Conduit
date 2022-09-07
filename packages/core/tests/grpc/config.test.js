let client;
let coreProcess;

beforeAll(async () => {
  const { exec } = require('child_process');
  const options = {
    env: { ...process.env, REDIS_PORT: 6379, REDIS_HOST: 'localhost', PORT: 3030, ADMIN_SOCKET_PORT: 3032 },
  };
  exec('sh ./tests/scripts/redis.sh');
  await new Promise((r) => setTimeout(r, 2000));
  coreProcess = exec('node ./dist/bin/www.js', options);
  await new Promise((r) => setTimeout(r, 5000));

  const path = require('path');
  const protoLoader = require('@grpc/proto-loader');
  const grpc = require('@grpc/grpc-js');
  const current_path = path.join(__dirname, '..', '..', 'src/core.proto');
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
});