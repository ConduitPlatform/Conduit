let client;
describe('Testing Config package',() => {
  beforeAll(() => {
    const path = require('path');
    const protoLoader = require('@grpc/proto-loader');
    const grpc = require('@grpc/grpc-js');
    const current_path = path.join(__dirname,'..','..','src/core.proto')
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
    client.getRedisDetails({},(err,res) => {
      expect(res).toMatchObject({
        redisPort: expect(Number),
        redisHost: expect.any(String)
      })
    });
  });
})