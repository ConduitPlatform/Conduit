import {
  ConduitBoolean,
  ConduitError,
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
import url from 'url';

export function generateGraphQlClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate-graphql-client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        plugin: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('generateGraphQlClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      let response: any[] = [];
      const outputPath = path.resolve(__dirname, 'dist/generated_graphql_client.d.ts');
      try {
        await generate({
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
              plugins: selectPlugin(request.params!.plugin),
            },
          },
        });
        response.push({
          generated: 'ok',
          file: url.pathToFileURL(outputPath).href,
        });
        return { result: response };
      } catch (error) {
        throw new ConduitError((error as Error).name, 500, (error as Error).message);
      }
    }
  );
}

function selectPlugin(pluginName: string): string[] {
  switch (pluginName) {
    case 'typescript':
      return ['typescript', 'typescript-operations'];
    case 'react':
      return ['typescript', 'typescript-operations', 'typescript-react-query'];
    case 'angular':
      return ['typescript', 'typescript-operations', 'typescript-apollo-angular'];
    case 'vue':
      return ['typescript', 'typescript-operations', 'typescript-vue-urql'];
    case 'svelte':
      return ['typescript', 'typescript-operations', 'graphql-codegen-svelte-apollo'];
    default:
      throw new ConduitError('Invalid Plugin', 400, 'Invalid Plugin');
  }
}
