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
import fs, { unlink } from 'fs';
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
      fileName: ConduitString.Required,
      fileType: ConduitString.Required,
      file: ConduitString.Required,
    }),
    async (request: ConduitRouteParameters) => {
      const clientType = request.params!.clientType;
      const outputPath = path.resolve(__dirname, 'generate/rest');
      const inputSpec = request.params!.isAdmin ? 'admin/swagger.json' : 'swagger.json';
      try {
        await exec(
          `openapi-generator generate -i http://localhost:${
            process.env['PORT'] ?? '3000'
          }/${inputSpec} -g ${clientType} -o ${outputPath} --skip-validate-spec`
        );

        const zipPath = path.resolve(__dirname, 'generate/rest.zip');
        await exec(`zip -r ${zipPath} ${outputPath}`);
        const file = fs.readFileSync(zipPath).toString('base64');
        unlink(zipPath, (err) => {
          if (err) throw new ConduitError(err.name, status.INTERNAL, err.message);
        });
        return {
          result: {
            fileName: `${clientType}.zip`,
            fileType: 'application/zip',
            file,
          },
        };
      } catch (error) {
        throw new ConduitError(
          (error as Error).name,
          status.INTERNAL,
          (error as Error).message
        );
      }
    }
  );
}
