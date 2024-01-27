import { SwaggerParser } from './SwaggerParser.js';
import { cloneDeep, isNil } from 'lodash-es';
import { ConduitModel, ConduitRouteActions, Indexable } from '@conduitplatform/grpc-sdk';
import { SwaggerRouterMetadata } from '../types/index.js';
import { ConduitRoute } from '../classes/index.js';
import { importDbTypes } from '../utils/types.js';
import { processSwaggerParams } from './SimpleTypeParamUtils.js';

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
      paths: {},
      components: {
        schemas: {
          ModelId: {
            type: 'string',
            format: 'uuid',
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
