import * as testingTools from '@conduitplatform/testing-tools';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { ConfigDefinition } from '@conduitplatform/testing-tools/src/protoUtils/core';
import { DatabaseProviderDefinition } from '@conduitplatform/testing-tools/src/protoUtils/database';
import axios from 'axios';
import { adminRoutes } from './utils/adminRoutes';
import { signToken, verifyToken } from '../src/utils/auth';
import { sleep } from '@conduitplatform/grpc-sdk/src/utilities';

let dependencies: ChildProcess[];
const testModule = testingTools.getTestModule<ConfigDefinition>(
  'test',
  '0.0.0.0:55152',
  ConfigDefinition,
);
const testClient = testModule.getModuleClient('test', ConfigDefinition);

const db = testingTools.getTestModule<DatabaseProviderDefinition>(
  'database',
  '0.0.0.0:55187',
  DatabaseProviderDefinition,
);
const dbClient = db.getModuleClient('database');

beforeAll(async () => {
  await testingTools.baseSetup();
  dependencies = await testingTools.runDependencies([
    {
      command: 'node ' + path.resolve(__dirname, '../../core/dist/bin/www.js'),
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
    {
      command:
        'node ' + path.resolve(__dirname, '../../../modules/database/dist/index.js'),
      ExecOptions: {
        env: {
          _DB_CONN_URI: 'mongodb://conduit:pass@localhost',
          _DB_TYPE: 'mongodb',
          _GRPC_KEY: 'H+MbQeThWmZq4t6w',
          _MAX_CONN_TIMEOUT_MS: 1000,
          CONDUIT_SERVER: '0.0.0.0:55152',
          GRPC_PORT: '55187',
          SERVICE_URL: '0.0.0.0:55187',
        },
      },
      delay: 8000,
    },
  ]);
});

describe('Dependency check', () => {
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

describe('Check Admin Initialization', () => {
  test('Get Config', async () => {
    const res = await dbClient.findOne({ schemaName: 'Config', query: '{}' });
    //check entire config obj except for the tokenSecret field
    const resultConfig = JSON.parse(res.result);
    delete resultConfig.moduleConfigs.admin.auth.tokenSecret;
    const config = {
      auth: {
        hashRounds: 11,
        tokenExpirationTime: 72000,
      },
      hostUrl: 'http://localhost:3030',
      transports: {
        rest: true,
        graphql: false,
        sockets: false,
      },
    };
    expect(resultConfig.moduleConfigs.admin).toMatchObject(config);
  });

  test('Check Admin Routes', async () => {
    adminRoutes.forEach(obj => {
      obj.methods.forEach(async method => {
        const requestOptions = {
          method: method,
          url: 'http://localhost:3030' + obj.path,
          data: {},
        };
        await axios(requestOptions).catch(e => {
          expect(e.response.status).not.toEqual(404);
        });
      });
    });
  });

  test('Register schemas', async () => {
    const schemas = await dbClient.getSchemas({});
    const resultSchemas = schemas.schemas.filter(schema => {
      if (schema.name === 'Admin' || schema.name === 'AdminTwoFactorSecret') {
        return schema;
      }
    });
    expect(resultSchemas).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Admin' })]),
    );
    expect(resultSchemas).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'AdminTwoFactorSecret' })]),
    );
  });

  test('Admin user creation', async () => {
    const admin = await dbClient.findOne({ schemaName: 'Admin', query: '{}' });
    const resultAdmin = JSON.parse(admin.result);
    expect(resultAdmin).not.toBeNull();
    expect(resultAdmin).toBeDefined();
    expect(resultAdmin).not.toEqual({});
  });
});

describe('Check Admin Authorization', () => {
  let token: string;
  let tokenSecret: string;

  test('Successfully Login', async () => {
    const requestOptions = {
      method: 'POST',
      url: 'http://localhost:3030/login',
      headers: {
        masterKey: 'M4ST3RK3Y',
      },
      data: {
        username: 'admin',
        password: 'admin',
      },
    };
    const response = await axios(requestOptions);
    token = response.data.token;
    expect(response.status).toEqual(200);

    const res = await dbClient.findOne({ schemaName: 'Config', query: '{}' });
    const config = JSON.parse(res.result);
    tokenSecret = config.moduleConfigs.admin.auth.tokenSecret;
    const verified = verifyToken(token, tokenSecret);
    expect(verified).not.toEqual(401);
  });

  test('Request with invalid masterKey', async () => {
    let requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'InvalidMasterKey',
        Authorization: 'Bearer ' + token,
      },
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(401);
    });
  });

  test('Request with invalid/expired token', async () => {
    let requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'M4ST3RK3Y',
        Authorization: 'Bearer InvalidToken',
      },
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(401);
    });

    requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'M4ST3RK3Y',
        Authorization: 'Bearer' + token,
      },
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(401);
    });

    requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'M4ST3RK3Y',
        Authorization: 'JWT ' + token,
      },
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(401);
    });

    const admin = await dbClient.findOne({ schemaName: 'Admin', query: '{}' });
    const resultAdmin = JSON.parse(admin.result);
    const expiredToken = signToken({ id: resultAdmin._id }, tokenSecret, 1);
    requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'M4ST3RK3Y',
        Authorization: 'Bearer ' + expiredToken,
      },
    };
    sleep(1000).then(async () => {
      await axios(requestOptions).catch(e => {
        expect(e.response.status).toEqual(401);
      });
    });

    const twoFaToken = signToken(
      { id: resultAdmin._id, twoFaRequired: true },
      tokenSecret,
      60,
    );
    requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/admins',
      headers: {
        masterKey: 'M4ST3RK3Y',
        Authorization: 'Bearer ' + twoFaToken,
      },
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(401);
    });
  });
});

describe('Additional Middleware checks', () => {
  test('Check Excluded Routes', async () => {
    const options = {
      method: 'GET',
      url: 'http://localhost:3030/config/modules',
      headers: {
        masterKey: 'M4ST3RK3Y',
      },
    };
    await axios(options).catch(e => {
      expect(e.response.status).toEqual(200);
    });

    let requestOptions = {
      method: 'GET',
      url: 'http://localhost:3030/ready',
    };
    await axios(requestOptions).catch(e => {
      expect(e.response.status).toEqual(200);
    });

    let config = await testClient.get({ key: 'core' });
    let resultConfig = JSON.parse(config.data);
    if (resultConfig.env === 'development') {
      requestOptions = {
        method: 'GET',
        url: 'http://localhost:3030/swagger',
      };
      await axios(requestOptions).catch(e => {
        expect(e.response.status).toEqual(200);
      });
    }

    config = await testClient.get({ key: 'admin' });
    resultConfig = JSON.parse(config.data);
    if (resultConfig.transports.graphql) {
      requestOptions = {
        method: 'GET',
        url: 'http://localhost:3030/graphql',
      };
      await axios(requestOptions).catch(e => {
        expect(e.response.status).toEqual(200);
      });
    }
  });
});

afterAll(async () => {
  try {
    dependencies.forEach(dependency => {
      process.kill(dependency.pid);
    });
  } catch {}
  // await testingTools.stopRedis();
  testModule.disconnect();
  db.disconnect();
});
