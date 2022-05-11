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
import { status } from '@grpc/grpc-js';
import fs, { unlink } from 'fs';

export function generateGraphQlClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate/graphql',
      action: ConduitRouteActions.POST,
      bodyParams: {
        clientType: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('generateGraphQlClient', {
      fileName: ConduitString.Required,
      fileType: ConduitString.Required,
      file: ConduitString.Required,
    }),
    async (request: ConduitRouteParameters) => {
      const { plugins, fileName } = selectPlugin(request.params!.clientType);
      const outputPath = path.resolve(__dirname, `generate/${fileName}`);
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
              plugins,
            },
          },
        });
        const file = fs.readFileSync(outputPath).toString('base64');
        unlink(outputPath, (err) => {
          if (err) throw new ConduitError(err.name, status.INTERNAL, err.message);
        });
        return {
          result: {
            fileName,
            fileType: 'text',
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

function selectPlugin(pluginName: string) {
  switch (pluginName) {
    case 'typescript':
      return {
        plugins: ['typescript', 'typescript-operations'],
        fileName: 'types.ts',
      };
    case 'react':
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-react-query'],
        fileName: 'types.react-query.ts',
      };
    case 'react-apollo':
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        fileName: 'types.reactApollo.tsx',
      };
    case 'angular':
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-apollo-angular'],
        fileName: 'types.apolloAngular.ts',
      };
    case 'vue':
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-vue-urql'],
        fileName: 'types.vue-urql.ts',
      };
    case 'svelte':
      return {
        plugins: ['typescript', 'typescript-operations', 'graphql-codegen-svelte-apollo'],
        fileName: 'types.svelte-apollo.ts',
      };
    default:
      throw new ConduitError('Invalid Plugin', status.INVALID_ARGUMENT, 'Invalid Plugin');
  }
}
