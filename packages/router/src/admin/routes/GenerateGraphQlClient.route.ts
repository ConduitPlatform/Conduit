import {
  ConduitBoolean,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  ConduitString,
  TYPE, 
} from '@conduitplatform/commons';
import { ConduitDefaultRouter } from '../..';
import { generate } from '@graphql-codegen/cli';
import path from 'path';
import url  from 'url';

export function generateGraphQlClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate-graphql-client',
      action: ConduitRouteActions.POST,
      bodyParams: {},
    },
    new ConduitRouteReturnDefinition('generateGraphQlClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      let response: any[] = [];
      const outputPath = path.resolve(__dirname, 'dist/generated_graphql_client.d.ts');
      console.log(request);
      
      const generated = await generate({
        schema: {
          'http://localhost:3000/graphql': {
            headers: {
              clientid: request.headers.clientid as string,
              clientsecret: request.headers.clientsecret as string,
            },
          },
        },
        generates: {
          [outputPath]: {
            plugins: ['typescript'],
          },
        },
      });
      console.log(generated);
      response.push({
        generated: 'ok',
        file: url.pathToFileURL(outputPath).href,
      })
      return { result: response };
    }
  );
}
