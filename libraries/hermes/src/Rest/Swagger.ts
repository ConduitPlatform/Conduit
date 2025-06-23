import { SwaggerParser } from './SwaggerParser.js';
import { cloneDeep, isNil } from 'lodash-es';
import { ConduitModel, ConduitRouteActions, Indexable } from '@conduitplatform/grpc-sdk';
import { SwaggerRouterMetadata } from '../types/index.js';
import { ConduitRoute } from '../classes/index.js';
import { importDbTypes } from '../utils/types.js';
import { processSwaggerParams } from './SimpleTypeParamUtils.js';
import { mapGrpcErrorToHttp } from './util.js';

interface SwaggerExample {
  name: string;
  message: string;
  conduitCode: string;
}

interface SwaggerResponseContent {
  schema: { $ref: string };
  example?: SwaggerExample;
  examples?: Record<string, { value: SwaggerExample }>;
}

export class SwaggerGenerator {
  private _swaggerDoc: Indexable;
  private _routerMetadata: SwaggerRouterMetadata;
  private readonly _parser: SwaggerParser;

  constructor(readonly getSwaggerRouterMetadata: () => SwaggerRouterMetadata) {
    this.cleanup();
    this._parser = new SwaggerParser();
  }

  cleanup() {
    this._routerMetadata = this.getSwaggerRouterMetadata();
    this._swaggerDoc = {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'Conduit',
      },
      servers: this._routerMetadata.servers ?? [],
      paths: {},
      components: {
        schemas: {
          ModelId: {
            type: 'string',
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'HTTP error name',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
              conduitCode: {
                type: 'string',
                description: 'Conduit internal error code',
              },
            },
            required: ['httpCode', 'conduitCode', 'description'],
          },
        },
        securitySchemes: this._routerMetadata.securitySchemes,
      },
    };
  }

  get swaggerDoc() {
    return this._swaggerDoc;
  }

  addRouteSwaggerDocumentation(route: ConduitRoute) {
    const method = this._extractMethod(route.input.action);
    const baseName = route.input.path.toString().replace('/hook', '').slice(1);
    const prefix =
      baseName.indexOf('/') !== -1 ? baseName.substring(0, baseName.indexOf('/')) : '';
    let serviceName: string;
    if (baseName.startsWith('admin')) {
      serviceName = 'admin';
    } else if (prefix.trim() === '') {
      serviceName = 'core';
    } else {
      serviceName = prefix;
    }
    const routeDoc: Indexable = {
      summary: route.input.name,
      description: route.input.description,
      tags: [serviceName],
      parameters: [],
      responses: {
        200: {
          description: 'Successful Operation',
          content: {
            'application/json': {
              schema: {},
            },
          },
        },
      },
      security: cloneDeep(this._routerMetadata.globalSecurityHeaders),
    };

    if (
      !isNil(route.input.urlParams) &&
      (route.input.urlParams as unknown as string) !== ''
    ) {
      for (const name in route.input.urlParams) {
        routeDoc.parameters.push({
          name,
          in: 'path',
          required: true,
          schema: processSwaggerParams(route.input.urlParams[name]),
          //@ts-ignore
          description: route.input.urlParams[name].description,
        });
      }
    }

    if (
      !isNil(route.input.queryParams) &&
      (route.input.queryParams as unknown as string) !== ''
    ) {
      for (const name in route.input.queryParams) {
        const tmpSchema = processSwaggerParams(route.input.queryParams[name]);
        routeDoc.parameters.push({
          name,
          in: 'query',
          required:
            (route.input.queryParams[name] as { required: boolean }).required ?? false,
          schema: tmpSchema,
          //@ts-ignore
          description: route.input.queryParams[name].description,
        });
      }
    }

    if (
      !isNil(route.input.bodyParams) &&
      (route.input.bodyParams as unknown as string) !== ''
    ) {
      routeDoc['requestBody'] = {
        description: route.input.description,
        content: {
          'application/json': {
            schema: this._parser.extractTypes('body', route.input.bodyParams, true),
          },
        },
        required: true,
      };
    }

    this._routerMetadata.setExtraRouteHeaders(route, routeDoc);

    const returnDefinition = this._parser.extractTypes(
      route.returnTypeName,
      route.returnTypeFields,
      false,
    );
    routeDoc.responses[200].content['application/json'].schema = {
      $ref: `#/components/schemas/${route.returnTypeName}`,
    };
    if (!isNil(routeDoc['requestBody']) || !isNil(routeDoc['parameters'])) {
      routeDoc.responses[400] = {
        description:
          'Invalid parameters provided. Check the documentation for more info.',
      };
    }

    routeDoc.responses[500] = {
      description: 'Internal Server Error',
    };
    if (!this._swaggerDoc.components['schemas'][route.returnTypeName]) {
      this._swaggerDoc.components['schemas'][route.returnTypeName] = returnDefinition;
    }
    const path =
      this._routerMetadata.urlPrefix + route.input.path.replace(/(:)(\w+)/g, '{$2}');
    if (this._swaggerDoc.paths.hasOwnProperty(path)) {
      this._swaggerDoc.paths[path][method] = routeDoc;
    } else {
      this._swaggerDoc.paths[path] = {};
      this._swaggerDoc.paths[path][method] = routeDoc;
    }

    const errors = route.input.errors || [];
    const errorGroups: Record<
      string,
      Record<
        string,
        { name: string; message: string; conduitCode: string; description: string }[]
      >
    > = {};
    for (const error of errors) {
      const { conduitCode, grpcCode, message, description } = error;
      const { name, status } = mapGrpcErrorToHttp(grpcCode);
      if (!errorGroups[status]) errorGroups[status] = {};
      if (!errorGroups[status][conduitCode]) errorGroups[status][conduitCode] = [];
      errorGroups[status][conduitCode].push({
        name,
        message,
        conduitCode,
        description,
      });
    }

    for (const status in errorGroups) {
      const allExamples: {
        name: string;
        message: string;
        conduitCode: string;
        description: string;
      }[] = [];
      for (const conduitCode in errorGroups[status]) {
        allExamples.push(...errorGroups[status][conduitCode]);
      }
      const responseContent: { 'application/json': SwaggerResponseContent } = {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse',
          },
        },
      };
      if (allExamples.length === 1) {
        responseContent['application/json']['example'] = {
          name: allExamples[0].name,
          message: allExamples[0].message,
          conduitCode: allExamples[0].conduitCode,
        };
      } else if (allExamples.length > 1) {
        responseContent['application/json']['examples'] = {};
        allExamples.forEach(example => {
          const { name, message, conduitCode, description } = example;
          if (responseContent['application/json']['examples']) {
            responseContent['application/json']['examples'][description] = {
              value: {
                name,
                message,
                conduitCode,
              },
            };
          }
        });
      }
      routeDoc.responses[status] = {
        content: responseContent,
      };
    }
  }

  private _extractMethod(action: string) {
    switch (action) {
      case ConduitRouteActions.GET: {
        return 'get';
      }
      case ConduitRouteActions.POST: {
        return 'post';
      }
      case ConduitRouteActions.DELETE: {
        return 'delete';
      }
      case ConduitRouteActions.UPDATE: {
        return 'put';
      }
      case ConduitRouteActions.PATCH: {
        return 'patch';
      }
      default: {
        return 'get';
      }
    }
  }

  importDbTypes() {
    importDbTypes(this._parser, this.updateSchemaType.bind(this));
  }

  updateSchemaType(schemaName: string, schemaFields: ConduitModel) {
    this._swaggerDoc.components.schemas[schemaName] = this._parser.extractTypes(
      schemaName,
      schemaFields,
      false,
    );
  }
}
