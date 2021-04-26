import { ConduitRoute, ConduitRouteActions } from '@quintessential-sft/conduit-commons';
import { extractRouteReturnProperties } from './util';

export class SwaggerGenerator {
  private _swaggerDoc: any;

  constructor() {
    this._swaggerDoc = {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'Conduit',
      },
      paths: {},
      components: {
        securitySchemes: {
          clientid: {
            type: 'apiKey',
            in: 'header',
            name: 'clientid',
          },
          clientSecret: {
            type: 'apiKey',
            in: 'header',
            name: 'clientSecret',
          },
          tokenAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
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
      default: {
        return 'get';
      }
    }
  }

  addRouteSwaggerDocumentation(route: ConduitRoute) {
    let method = this._extractMethod(route.input.action);
    let serviceName = route.input.path.toString().replace('/hook', '').slice(1);
    serviceName = serviceName.substr(0, serviceName.indexOf('/'));
    if (serviceName.trim() === '') {
      serviceName = 'core';
    }
    let routeDoc: any = {
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
        {
          clientid: [],
          clientSecret: [],
        },
      ],
    };

    if (route.input.urlParams !== undefined) {
      for (const name in route.input.urlParams) {
        routeDoc.parameters.push({
          name,
          in: 'path',
          required: true,
          type: route.input.urlParams[name],
        });
      }
    }

    if (route.input.queryParams !== undefined) {
      for (const name in route.input.queryParams) {
        routeDoc.parameters.push({
          name,
          in: 'query',
          type: route.input.queryParams[name],
        });
      }
    }

    if (route.input.bodyParams !== undefined) {
      for (const name in route.input.bodyParams) {
        let type = '';
        if (typeof route.input.bodyParams[name] === 'object') {
          // @ts-ignore
          if (
            route.input.bodyParams[name] &&
            // @ts-ignore
            route.input.bodyParams[name].type &&
            // @ts-ignore
            typeof route.input.bodyParams[name].type !== 'object'
          ) {
            // @ts-ignore
            type = route.input.bodyParams[name].type.toLowerCase();
          } else {
            type = 'object';
          }

          if (!['string', 'number', 'array', 'object'].includes(type)) {
            type = 'string';
          }
        } else {
          type = route.input.bodyParams[name].toString().toLowerCase();
        }
        routeDoc.parameters.push({
          name,
          in: 'body',
          type,
        });
      }
    }

    if (route.input.middlewares?.includes('authMiddleware')) {
      routeDoc.security[0].tokenAuth = [];
    }

    routeDoc.responses[200].content[
      'application/json'
    ].schema = extractRouteReturnProperties(route.returnTypeFields);

    let path = route.input.path.replace(/(:)(\w+)/g, '{$2}');
    if (this._swaggerDoc.paths.hasOwnProperty(path)) {
      this._swaggerDoc.paths[path][method] = routeDoc;
    } else {
      this._swaggerDoc.paths[path] = {};
      this._swaggerDoc.paths[path][method] = routeDoc;
    }
    this._swaggerDoc.paths[path] = { ...this._swaggerDoc.paths[path], method };
  }

  get swaggerDoc() {
    return this._swaggerDoc;
  }
}
