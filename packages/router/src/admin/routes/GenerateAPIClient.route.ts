import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  ConduitString,
  TYPE,
} from '@conduitplatform/commons';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConduitDefaultRouter } from '../..';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import path from 'path';
import url from 'url';

export function generateAPIClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate-client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        outputLanguage: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GenerateAPIClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      let response: any[] = [];
      console.log(request);
      const outputLanguage = request.params!.outputLanguage;
      const outputPath = path.resolve(__dirname, 'dist/generated_openapi_client');
      console.log(outputPath);

      let { error, stdout } = await exec(
        `openapi-generator generate -i http://localhost:${
          process.env['PORT'] ?? '3000'
        }/swagger.json -g ${outputLanguage} -o ${outputPath}`
      );
      if (error) {
        throw new GrpcError(status.INTERNAL, error.message);
      }
      console.log(stdout);
      const tarPath = path.resolve(__dirname, 'dist/openapi-generator-cli.tar.gz');
      ({ error, stdout } = await exec(`tar -czf ${tarPath} -C ${outputPath} .`));
      if (error) {
        throw new GrpcError(status.INTERNAL, error.message);
      }
      console.log(stdout);
      response.push({
        generated: 'ok',
        file: url.pathToFileURL(tarPath).href,
      });
      return { result: response };
    }
  );
}
