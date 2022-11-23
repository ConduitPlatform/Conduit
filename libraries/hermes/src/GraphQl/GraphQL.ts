import express, { NextFunction, Request, Response } from 'express';
import { GraphQlParser, ParseResult } from './GraphQlParser';
import { findPopulation } from './utils/TypeUtils';
import { GraphQLJSONObject } from 'graphql-type-json';
import { GraphQLScalarType, Kind } from 'graphql';
import 'apollo-cache-control';
import { createHashKey, extractCachingGql } from '../cache.utils';
import moment from 'moment';
import { processParams } from './utils/SimpleTypeParamUtils';
import { importDbTypes } from '../utils/types';
import { ConduitRouter } from '../Router';
import { errorHandler } from './utils/Request.utils';
import ConduitGrpcSdk, {
  ConduitModel,
  ConduitRouteActions,
  ConduitRouteOption,
  ConduitRouteOptions,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, TypeRegistry } from '../classes';

const { parseResolveInfo } = require('graphql-parse-resolve-info');
const { ApolloServer } = require('apollo-server-express');
const cookiePlugin = require('./utils/cookie.plugin');

export class GraphQLController extends ConduitRouter {
  typeDefs!: string;
  types!: string;
  queries!: string;
  mutations!: string;
  resolvers: any;
  private _apollo?: express.Router;
  private _relationTypes: string[] = [];
  private _apolloRefreshTimeout: NodeJS.Timeout | null = null;
  private readonly _parser: GraphQlParser;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly metrics?: {
      registeredRoutes?: {
        name: string;
      };
    },
  ) {
    super(grpcSdk);
    this.initialize();
    this._parser = new GraphQlParser();
    TypeRegistry.getInstance(grpcSdk, {
      name: 'graphql',
      updateHandler: this.updateSchemaType.bind(this),
    });
  }

  refreshGQLServer() {
    if (!this.typeDefs || this.typeDefs === ' ' || !this.resolvers) return;
    this.importDbTypes();
    const server = new ApolloServer({
      typeDefs: this.typeDefs,
      resolvers: this.resolvers,
      plugins: [cookiePlugin],
      context: ({ req, res }: Indexable) => {
        const context = req.conduit || {};
        const headers = req.headers;
        const cookies = req.cookies || {};
        return { context, headers, cookies, setCookie: [], removeCookie: [], res };
      },
    });
    this._apollo = server.getMiddleware();
  }

  generateType(
    name: string,
    fields: ConduitModel | ConduitRouteOption | string,
    dbTypeRefresh = false,
  ) {
    const typeExists = this.typeDefs.includes('type ' + name + ' ');
    if (typeExists && !dbTypeRefresh) return;
    const self = this;
    const parseResult: ParseResult = this._parser.extractTypes(name, fields, false);
    if (typeExists) {
      const start = this.types.indexOf(`type ${name} `);
      const end = this.types.indexOf('\n', start);
      this.types =
        this.types.substring(0, start) +
        parseResult.typeString +
        this.types.substring(end);
    } else {
      this.types += parseResult.typeString;
    }
    parseResult.relationTypes.forEach((type: string) => {
      if (self._relationTypes.indexOf(type) === -1) {
        self._relationTypes.push(type);
      }
    });

    if (
      this.types.includes('JSONObject') &&
      this.types.indexOf('scalar JSONObject') === -1
    ) {
      this.types += '\n scalar JSONObject \n';
      this.resolvers['JSONObject'] = GraphQLJSONObject;
    }

    for (const resolveGroup in parseResult.parentResolve) {
      if (!parseResult.parentResolve.hasOwnProperty(resolveGroup)) continue;
      if (!self.resolvers[resolveGroup]) {
        self.resolvers[resolveGroup] = {};
      }
      for (const resolverFunction in parseResult.parentResolve[resolveGroup]) {
        if (!parseResult.parentResolve[resolveGroup].hasOwnProperty(resolverFunction))
          continue;
        if (!self.resolvers[resolveGroup][resolverFunction]) {
          self.resolvers[resolveGroup][resolverFunction] =
            parseResult.parentResolve[resolveGroup][resolverFunction];
        }
      }
    }
  }

  generateAction(input: ConduitRouteOptions, returnType: string) {
    // todo refine this, simply replacing : with empty is too dumb
    let cleanPath: string = input.path;
    while (cleanPath.indexOf('-') !== -1) {
      cleanPath = cleanPath.replace('-', '');
    }
    while (cleanPath.indexOf(':') !== -1) {
      cleanPath = cleanPath.replace(':', '');
    }
    let pathName: string[] = cleanPath.split('/');
    if (
      pathName[pathName.length - 1].length === 0 ||
      pathName[pathName.length - 1] === ''
    ) {
      pathName = pathName.slice(0, pathName.length - 1);
    } else {
      pathName = pathName.slice(0, pathName.length);
    }
    let uniqueName: string = '';
    pathName.forEach(r => {
      uniqueName += r.slice(0, 1).toUpperCase() + r.slice(1);
    });
    const name = input.name ? input.name : input.action.toLowerCase() + uniqueName;

    let params = '';
    if (input.bodyParams || input.queryParams || input.urlParams) {
      if (input.bodyParams) {
        const parseResult: ParseResult = this._parser.extractTypes(
          name + 'Request',
          input.bodyParams,
          true,
        );
        this.types += parseResult.typeString;
        params += (params.length > 1 ? ',' : '') + 'params' + ':';
        params += name + 'Request';
      }

      if (input.queryParams) {
        params = processParams(input.queryParams, params);
      }

      if (input.urlParams) {
        params = processParams(input.urlParams, params);
      }
      params = '(' + params + ')';
    }

    let description = '';
    if (input.description) {
      description = `""" ${input.description} """ `;
    }

    const finalName = description + name + params + ':' + returnType;
    if (input.action === ConduitRouteActions.GET && !this.queries.includes(finalName)) {
      this.queries += ' ' + finalName;
    } else if (
      input.action !== ConduitRouteActions.GET &&
      !this.mutations.includes(finalName)
    ) {
      this.mutations += ' ' + finalName;
    }
    return name;
  }

  generateQuerySchema() {
    if (this.queries.length > 1) {
      return 'type Query { ' + this.queries + ' }';
    }
    return '';
  }

  generateMutationSchema() {
    if (this.mutations.length > 1) {
      return 'type Mutation { ' + this.mutations + ' }';
    } else {
      return '';
    }
  }

  generateSchema() {
    this.typeDefs =
      this.types + ' ' + this.generateQuerySchema() + ' ' + this.generateMutationSchema();
  }

  shouldPopulate(args: Indexable, info: Indexable) {
    const resolveInfo = parseResolveInfo(info);
    let objs = resolveInfo.fieldsByTypeName;
    objs = objs[Object.keys(objs)[0]];
    const result = findPopulation(objs, this._relationTypes);
    if (result) {
      args['populate'] = result;
    }
    return args;
  }

  registerConduitRoute(route: ConduitRoute) {
    if (!this.routeChanged(route)) return;
    const key = `${route.input.action}-${route.input.path}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, route);
    if (!registered) {
      this.addConduitRoute(route);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'graphql',
        });
      }
    }
  }

  protected _refreshRouter() {
    this.initialize();
    this._registeredRoutes.forEach(route => {
      // we should probably implement some kind of caching for this
      // so it does not recalculate the types for the routes that have not changed
      // but it needs to be done carefully
      this.addConduitRoute(route);
    });
    this.scheduleApolloRefresh();
  }

  private initialize() {
    this.createRouter();
    this.resolvers = {
      Date: new GraphQLScalarType({
        name: 'Date',
        description: 'Date custom scalar type',
        parseValue(value) {
          return new Date(value); // value from the client
        },
        serialize(value) {
          return value; // value sent to the client
        },
        parseLiteral(ast) {
          if (ast.kind === Kind.INT) {
            return new Date(ast.value); // ast value is always in string format
          } else if (ast.kind === Kind.STRING) {
            return moment(ast.value).toDate();
          }
          return null;
        },
      }),
      Number: new GraphQLScalarType({
        name: 'Number',
        description: 'Number custom scalar type, is either int or float',
        parseValue(value) {
          // maybe wrong
          if (typeof value === 'string') {
            if (Number.isInteger(value)) {
              return Number.parseInt(value);
            } else if (!Number.isNaN(value)) {
              return Number.parseFloat(value);
            }
          } else {
            return value;
          }
        },
        serialize(value) {
          if (typeof value === 'string') {
            if (Number.isInteger(value)) {
              return Number.parseInt(value);
            } else if (!Number.isNaN(value)) {
              return Number.parseFloat(value);
            }
          } else {
            return value;
          }
        },
        parseLiteral(ast) {
          if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
            return ast.value;
          } else if (ast.kind == Kind.STRING) {
            if (Number.isInteger(ast.value)) {
              return Number.parseInt(ast.value);
            } else if (!Number.isNaN(ast.value)) {
              return Number.parseFloat(ast.value);
            }
          }
          return null;
        },
      }),
    };
    this.typeDefs = ` `;
    this.types = 'scalar Date\nscalar Number\n';
    this.queries = '';
    this.mutations = '';
    const self = this;

    this._expressRouter!.use('/', (req: Request, res: Response, next: NextFunction) => {
      if (self._apollo) {
        self._apollo(req, res, next);
      } else {
        next();
      }
    });
  }

  private extractResult(returnTypeFields: string, result: Indexable | string) {
    switch (returnTypeFields) {
      case TYPE.JSON:
        return JSON.parse(result as string);
      default:
        return result;
    }
  }

  private constructQuery(actionName: string, route: ConduitRoute) {
    if (!this.resolvers['Query']) {
      this.resolvers['Query'] = {};
    }
    const self = this;
    this.resolvers['Query'][actionName] = (
      parent: Indexable,
      args: Indexable,
      context: any,
      info: Indexable,
    ) => {
      const { caching, cacheAge, scope } = extractCachingGql(
        route,
        context.headers['Cache-Control'],
      );
      if (caching) {
        info.cacheControl.setCacheHint({ maxAge: cacheAge, scope });
      }
      args = self.shouldPopulate(args, info);
      context.path = route.input.path;
      let hashKey: string;
      return self
        .checkMiddlewares(context, route.input.middlewares)
        .then(r => {
          Object.assign(context.context, r);
          const { urlParams, queryParams } = this.splitParamsToPathAnUrlParams(
            args,
            route.input.urlParams,
          );
          const params = Object.assign(args, args.params);
          delete params.params;
          if (caching) {
            hashKey = createHashKey(context.path, context.context, params);
          }
          if (caching) {
            return self
              .findInCache(hashKey)
              .then((r: string | null) => {
                if (r) {
                  return { fromCache: true, data: JSON.parse(r) };
                } else {
                  return route.executeRequest.bind(route)({
                    ...context,
                    params,
                    urlParams,
                    queryParams,
                  });
                }
              })
              .catch(() => {
                return route.executeRequest.bind(route)({
                  ...context,
                  params,
                  urlParams,
                  queryParams,
                });
              });
          } else {
            return route.executeRequest.bind(route)({
              ...context,
              params,
              urlParams,
              queryParams,
            });
          }
        })
        .then(r => {
          let result;
          if (r.fromCache) {
            return r.data;
          } else {
            result = r.result ?? r;
          }
          try {
            // Handle gRPC route responses
            result = JSON.parse(result);
          } catch {
            if (typeof result === 'string') {
              // Nest plain string responses
              result = {
                result: this.extractResult(route.returnTypeFields as string, result),
              };
            }
          }
          if (caching) {
            this.storeInCache(hashKey, result, cacheAge!);
          }
          return result;
        })
        .catch(errorHandler);
    };
  }

  private constructMutation(actionName: string, route: ConduitRoute) {
    if (!this.resolvers['Mutation']) {
      this.resolvers['Mutation'] = {};
    }
    const self = this;
    this.resolvers['Mutation'][actionName] = (
      parent: Indexable,
      args: Indexable,
      context: any,
      info: Indexable,
    ) => {
      args = self.shouldPopulate(args, info);
      context.path = route.input.path;
      return self
        .checkMiddlewares(context, route.input.middlewares)
        .then(r => {
          Object.assign(context.context, r);
          const { urlParams, queryParams } = this.splitParamsToPathAnUrlParams(
            args,
            route.input.urlParams,
          );
          const params = Object.assign(args, args.params);
          delete params.params;
          return route.executeRequest.bind(route)({
            ...context,
            params: args,
            urlParams,
            queryParams,
          });
        })
        .then(r => {
          let result = r.result ? r.result : r;
          if (r.setCookies) {
            context.setCookie = r.setCookies;
          }
          if (r.removeCookies) {
            context.removeCookie = r.removeCookies;
          }

          try {
            // Handle gRPC route responses
            result = JSON.parse(result);
          } catch {
            if (typeof result === 'string') {
              // Nest plain string responses
              result = {
                result: this.extractResult(route.returnTypeFields as string, result),
              };
            }
          }

          return result;
        })
        .catch(errorHandler);
    };
  }

  private addConduitRoute(route: ConduitRoute) {
    this.generateType(route.returnTypeName, route.returnTypeFields);
    const actionName = this.generateAction(route.input, route.returnTypeName);
    this.generateSchema();

    if (route.input.action === ConduitRouteActions.GET) {
      this.constructQuery(actionName, route);
    } else {
      this.constructMutation(actionName, route);
    }
  }

  private scheduleApolloRefresh() {
    if (this._apolloRefreshTimeout) {
      clearTimeout(this._apolloRefreshTimeout);
      this._apolloRefreshTimeout = null;
    }
    this._apolloRefreshTimeout = setTimeout(() => {
      try {
        this.refreshGQLServer();
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
      this._apolloRefreshTimeout = null;
    }, 3000);
  }

  shutDown() {
    TypeRegistry.removeTransport('graphql');
    super.shutDown();
    if (this._apolloRefreshTimeout) {
      clearTimeout(this._apolloRefreshTimeout);
    }
    delete this._apollo;
  }

  private importDbTypes() {
    importDbTypes(this._parser, this.updateSchemaType.bind(this));
  }

  updateSchemaType(typeName: string, typeFields: ConduitModel, refresh = true) {
    this.generateType(typeName, typeFields, true);
    this.generateSchema();
    if (refresh) {
      // refresh on schema type update (TypeRegistry)
      // false on this.refreshGQLServer() -> importDbTypes() -> updateSchemaType()
      this.scheduleApolloRefresh();
    }
  }

  private splitParamsToPathAnUrlParams(params: Indexable, urlParams?: Indexable) {
    const queryParams: Indexable = {};
    const urlParamsResult: Indexable = {};
    for (const key in params) {
      if (key !== 'params') {
        if (!urlParams?.[key]) {
          queryParams[key] = params[key];
        } else {
          urlParamsResult[key] = params[key];
        }
      }
    }
    return { urlParams, queryParams };
  }
}
