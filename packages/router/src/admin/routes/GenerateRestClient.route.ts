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

export function generateRestClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate-rest-client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        outputLanguage: ConduitString.Required,
        isAdmin: ConduitBoolean.Optional,
      },
    },
    new ConduitRouteReturnDefinition('generateRestClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      let response: any[] = [];
      const outputLanguage = request.params!.outputLanguage;
      const outputPath = path.resolve(__dirname, 'dist/generated_openapi_client');
      const inputSpec = request.params!.isAdmin ? 'admin/swagger.json' : 'swagger.json';
      try {
        await exec(
          `openapi-generator generate -i http://localhost:${
            process.env['PORT'] ?? '3000'
          }/${inputSpec} -g ${outputLanguage} -o ${outputPath} --skip-validate-spec`
        );

        const tarPath = path.resolve(__dirname, 'dist/generated_openapi_client.tar.gz');
        await exec(`tar -czf ${tarPath} -C ${outputPath} .`);
        response.push({
          generated: 'ok',
          file: url.pathToFileURL(tarPath).href,
        });

        return { result: response };
      } catch (error) {
        throw new ConduitError((error as Error).name, 500, (error as Error).message);
      }
    }
  );
}
