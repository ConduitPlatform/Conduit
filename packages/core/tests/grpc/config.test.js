let client;
describe('Testing Config package', () => {
  beforeAll(() => {
    const { exec } = require('child_process');
    const options = {
      env: { ...process.env, REDIS_PORT: 6379, REDIS_HOST: 'localhost', PORT: 3030, ADMIN_SOCKET_PORT: 3032 }
    }
    exec("node ./dist/bin/www.js", options,function (err,stdout,stderr) {

    });
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
  test('Getting Redis Details', () => {
    try {
      client.getRedisDetails({}, (err, res) => {
        expect(res).toEqual(expect.objectContaining({
          redisHost: expect.any(String),
          redisPort: expect.any(Number),
        }));
      });
    } catch (e) {
      throw e;
    }
  });
});