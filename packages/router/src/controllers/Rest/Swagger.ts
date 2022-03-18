import { ConduitRoute, ConduitRouteActions } from '@conduitplatform/commons';
import { SwaggerParser } from './SwaggerParser';
import { isNil } from 'lodash';

export class SwaggerGenerator {
  private readonly _swaggerDoc: any;
  private readonly _globalSecurityHeaders: any;
  private _parser: SwaggerParser;

  constructor(securitySchemes: any, globalSecurityHeaders: any) {
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
        securitySchemes
      },
    };
    this._parser = new SwaggerParser();
    this._globalSecurityHeaders = globalSecurityHeaders;
  }

  get swaggerDoc() {
    return this._swaggerDoc;
  }

  addRouteSwaggerDocumentation(route: ConduitRoute) {
    const method = this._extractMethod(route.input.action);
    let serviceName = route.input.path.toString().replace('/hook', '').slice(1);
    serviceName = serviceName.substr(0, serviceName.indexOf('/'));
    if (serviceName.trim() === '') {
      serviceName = 'core';
    }
    const routeDoc: any = {
      summary: route.input.name,
      description: route.input.description,
      tags: [serviceName],
      parameters: [],
      responses: {
        200: {
          content: {
            'application/json': {
              schema: {},
            },
          },
        },
      },
      security: [
        this._globalSecurityHeaders,
      ],
    };

    if (!isNil(route.input.urlParams) && (route.input.urlParams as any) !== '') {
      for (const name in route.input.urlParams) {
        let type = '';
        if (typeof route.input.urlParams[name] === 'object') {
          // @ts-ignore
          if (
            route.input.urlParams[name] &&
            // @ts-ignore
            route.input.urlParams[name].type &&
            // @ts-ignore
            typeof route.input.urlParams[name].type !== 'object'
          ) {
            // @ts-ignore
            type = route.input.urlParams[name].type.toLowerCase();
          } else {
            type = 'object';
          }

          if (!['string', 'number', 'boolean', 'array', 'object'].includes(type)) {
            type = 'string';
          }
        } else {
          type = route.input.urlParams[name].toString().toLowerCase();
        }
        routeDoc.parameters.push({
          name,
          in: 'path',
          required: true,
          type: route.input.urlParams[name],
        });
      }
    }

    if (!isNil(route.input.queryParams) && (route.input.queryParams as any) !== '') {
      for (const name in route.input.queryParams) {
        let type = '';
        if (typeof route.input.queryParams[name] === 'object') {
          // @ts-ignore
          if (
            route.input.queryParams[name] &&
            // @ts-ignore
            route.input.queryParams[name].type &&
            // @ts-ignore
            typeof route.input.queryParams[name].type !== 'object'
          ) {
            // @ts-ignore
            type = route.input.queryParams[name].type.toLowerCase();
          } else {
            type = 'object';
          }

          if (!['string', 'number', 'boolean', 'array', 'object'].includes(type)) {
            type = 'string';
          }
        } else {
          type = route.input.queryParams[name].toString().toLowerCase();
        }
        routeDoc.parameters.push({
          name,
          in: 'query',
          type: type,
        });
      }
    }

    if (!isNil(route.input.bodyParams) && (route.input.bodyParams as any) !== '') {
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

    // User: AuthMiddleware
    if (route.input.middlewares?.includes('authMiddleware')) {
      routeDoc.security[0].userToken = [];
    }

    // Admin: AdminMiddleware
    if ('masterKey' in routeDoc.security[0] && route.returnTypeName !== 'Login' && route.returnTypeName !== 'GetModules') {
      routeDoc.security[0].adminToken = [];
    }

    const returnDefinition = this._parser.extractTypes(
      route.returnTypeName,
      route.returnTypeFields,
      false
    );
    routeDoc.responses[200].content['application/json'].schema = {
      $ref: `#/components/schemas/${route.returnTypeName}`,
    };
    if (!this._swaggerDoc.components['schemas'][route.returnTypeName]) {
      this._swaggerDoc.components['schemas'][route.returnTypeName] = returnDefinition;
    }
    let path = route.input.path.replace(/(:)(\w+)/g, '{$2}');
    if (this._swaggerDoc.paths.hasOwnProperty(path)) {
      this._swaggerDoc.paths[path][method] = routeDoc;
    } else {
      this._swaggerDoc.paths[path] = {};
      this._swaggerDoc.paths[path][method] = routeDoc;
    }
    this._swaggerDoc.paths[path] = { ...this._swaggerDoc.paths[path], method };
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
}
