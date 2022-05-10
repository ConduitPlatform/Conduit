import {
  ConduitBoolean,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConduitError,
  TYPE,
} from '@conduitplatform/commons';
import { ConduitDefaultRouter } from '../..';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import path from 'path';
import url from 'url';
import fs from 'fs';
import { status } from '@grpc/grpc-js';

export function generateRestClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate/rest',
      action: ConduitRouteActions.POST,
      bodyParams: {
        clientType: ConduitString.Required,
        isAdmin: ConduitBoolean.Optional,
      },
    },
    new ConduitRouteReturnDefinition('generateRestClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      const clientType = request.params!.clientType;
      const outputPath = path.resolve(__dirname, 'dist/generate/rest');
      const inputSpec = request.params!.isAdmin ? 'admin/swagger.json' : 'swagger.json';
      try {
        await exec(
          `openapi-generator generate -i http://localhost:${
            process.env['PORT'] ?? '3000'
          }/${inputSpec} -g ${clientType} -o ${outputPath} --skip-validate-spec`
        );

        const tarPath = path.resolve(__dirname, 'dist/generate/rest.tar.gz');
        await exec(`tar -czf ${tarPath} -C ${outputPath} .`);
        const file = fs.readFileSync(tarPath).toString('base64');
        return {
          result: {
            generated: 'ok',
            file,
          }
        };
      } catch (error) {
        throw new ConduitError((error as Error).name, status.INTERNAL, (error as Error).message);
      }
    }
  );
}
