import {
  ConduitRoute,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/commons';
import { generate } from '@graphql-codegen/cli';
import path from 'path';
import { status } from '@grpc/grpc-js';
import fs, { unlink } from 'fs';
import { isEmpty } from 'lodash';
import {
  GrpcError, ConduitBoolean,
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';

export function generateGraphQlClient() {
  return new ConduitRoute(
    {
      path: '/router/generate/graphql',
      action: ConduitRouteActions.POST,
      bodyParams: {
        clientType: ConduitString.Required,
        config: {
          avoidOptionals: ConduitBoolean.Optional,
          immutableTypes: ConduitBoolean.Optional,
          preResolveTypes: ConduitBoolean.Optional,
          flattenGeneratedTypes: ConduitBoolean.Optional,
          enumsAsTypes: ConduitBoolean.Optional,
          fragmentMasking: ConduitBoolean.Optional,
          reactApolloVersion: ConduitString.Optional,
          operationResultSuffix: ConduitString.Optional,
        },
      },
    },
    new ConduitRouteReturnDefinition('generateGraphQlClient', {
      fileName: ConduitString.Required,
      fileType: ConduitString.Required,
      file: ConduitString.Required,
    }),
    async (request: ConduitRouteParameters) => {
      const config = JSON.parse(JSON.stringify(request.params?.config ?? {}));
      const { plugins, fileName } = selectPlugin(
        request.params!.clientType,
        Object.keys(config),
      );
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
              config,
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
          (error as Error).message,
        );
      }
    },
  );
}

function selectPlugin(pluginName: string, configOptions: string[]) {
  const baseOptions = [
    'avoidOptionals',
    'immutableTypes',
    'preResolveTypes',
    'flattenGeneratedTypes',
    'enumsAsTypes',
    'fragmentMasking',
  ];

  switch (pluginName) {
    case 'typescript':
      let fileNameExtension = checkConfig(baseOptions, configOptions);
      return {
        plugins: ['typescript', 'typescript-operations'],
        fileName: ` ${fileNameExtension}.ts`,
      };
    case 'react':
      fileNameExtension = checkConfig(baseOptions, configOptions);
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-react-query'],
        fileName: `types.react-query${fileNameExtension}.ts`,
      };
    case 'react-apollo':
      fileNameExtension = checkConfig(
        [...baseOptions, 'reactApolloVersion', 'operationResultSuffix'],
        configOptions,
      );
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
        fileName: `types.reactApollo${fileNameExtension}.tsx`,
      };
    case 'angular':
      fileNameExtension = checkConfig([...baseOptions], configOptions);
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-apollo-angular'],
        fileName: `types.apolloAngular${fileNameExtension}.ts`,
      };
    case 'vue-urql':
      fileNameExtension = checkConfig([...baseOptions], configOptions);
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-vue-urql'],
        fileName: `types.vue-urql${fileNameExtension}.ts`,
      };
    case 'vue-apollo':
      fileNameExtension = checkConfig([...baseOptions], configOptions);
      return {
        plugins: ['typescript', 'typescript-operations', 'typescript-vue-urql'],
        fileName: `types.vueApollo${fileNameExtension}.ts`,
      };
    case 'svelte':
      fileNameExtension = checkConfig([...baseOptions], configOptions);
      return {
        plugins: ['typescript', 'typescript-operations', 'graphql-codegen-svelte-apollo'],
        fileName: `types.svelte-apollo${fileNameExtension}.ts`,
      };
    default:
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid Plugin');
  }
}

/*
 * Checks if the configuration option for the generator are valid
 */
const checkConfig = (validOptions: string[], configOptions: string[]) => {
  if (isEmpty(configOptions)) {
    return '';
  }

  const invalidOptions = configOptions.filter((e) => !validOptions.includes(e));
  if (!isEmpty(invalidOptions)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Invalid config options: ${invalidOptions.join(',')}`,
    );
  }
  return `.${configOptions.join('.')}`;
};
