// todo Create the controller that creates GraphQL-specific endpoints
import {Application} from "express";
import {ConduitModel, ConduitRoute, ConduitRouteActions, ConduitRouteOptions} from "@conduit/sdk";
import {extractTypes, findPopulation, ParseResult} from "./TypeUtils";
import {GraphQLJSONObject} from "graphql-type-json";
import {GraphQLScalarType, Kind} from "graphql";

const {
    parseResolveInfo,
} = require('graphql-parse-resolve-info');
const {ApolloServer} = require('apollo-server-express');

export class GraphQLController {

    typeDefs: string;
    types: string;
    queries: string;
    mutations: string;
    resolvers: any;
    private _apollo?: any;
    private _relationTypes: string[] = [];

    constructor(app: Application) {
        this.resolvers = {
            Date: new GraphQLScalarType({
                name: 'Date',
                description: 'Date custom scalar type',
                parseValue(value) {
                    return new Date(value); // value from the client
                },
                serialize(value) {
                    return value.getTime(); // value sent to the client
                },
                parseLiteral(ast) {
                    if (ast.kind === Kind.INT) {
                        return new Date(ast.value) // ast value is always in string format
                    }
                    return null;
                },
            })
        };
        this.typeDefs = ` `;
        this.types = 'scalar Date\n';
        this.queries = '';
        this.mutations = '';
        const self = this;
        app.use('/', (req, res, next) => {
            if (self._apollo) {
                self._apollo(req, res, next)
            } else {
                next();
            }

        });
    }

    refreshGQLServer() {
        const server = new ApolloServer({
            typeDefs: this.typeDefs,
            resolvers: this.resolvers,
            context: ({req}: any) => {
                // get the user token from the headers
                return req.conduit;
            },
        });

        this._apollo = server.getMiddleware();
    }

    generateType(name: string, fields: ConduitModel | string) {
        if (this.typeDefs.includes(name)) {
            return;
        }
        const self = this;
        let parseResult: ParseResult = extractTypes(name, fields);
        this.types += parseResult.typeString;
        parseResult.relationTypes.forEach((type: string) => {
            if (self._relationTypes.indexOf(type) === -1) {
                self._relationTypes.push(type);
            }
        });

        if (this.types.includes('JSONObject') && this.types.indexOf('scalar JSONObject') === -1) {
            this.types += '\n scalar JSONObject \n';
            this.resolvers['JSONObject'] = GraphQLJSONObject;

        }

        for (let resolveGroup in parseResult.parentResolve) {
            if (!parseResult.parentResolve.hasOwnProperty(resolveGroup)) continue;
            if (!self.resolvers[resolveGroup]) {
                self.resolvers[resolveGroup] = {};
            }
            for (let resolverFunction in parseResult.parentResolve[resolveGroup]) {
                if (!parseResult.parentResolve[resolveGroup].hasOwnProperty(resolverFunction)) continue;
                if (!self.resolvers[resolveGroup][resolverFunction]) {
                    self.resolvers[resolveGroup][resolverFunction] = parseResult.parentResolve[resolveGroup][resolverFunction];
                }
            }

        }
    }

    generateAction(input: ConduitRouteOptions, returnType: string) {
        let pathName: string[] = input.path.split('/');
        if (pathName[pathName.length - 1].length === 0 || pathName[pathName.length - 1] === '') {
            pathName = pathName.slice(0, pathName.length - 1);
        } else {
            pathName = pathName.slice(0, pathName.length);
        }
        let uniqueName: string = ''
        pathName.forEach(r => {
            uniqueName += r.slice(0, 1).toUpperCase() + r.slice(1)
        })
        let name = input.name ? input.name : (input.action.toLowerCase() + uniqueName);

        let params = '';
        if (input.bodyParams || input.queryParams || input.urlParams) {
            if (input.bodyParams) {
                for (let k in input.bodyParams) {
                    params += (params.length > 1 ? ',' : '') + k.toString() + ':' + input.bodyParams[k];
                }
            }

            if (input.queryParams) {
                for (let k in input.queryParams) {
                    params += (params.length > 1 ? ',' : '') + k.toString() + ':' + input.queryParams[k];
                }
            }

            if (input.urlParams) {
                for (let k in input.urlParams) {
                    params += (params.length > 1 ? ',' : '') + k.toString() + ':' + input.urlParams[k];
                }
            }
            params = '(' + params + ')';
        }

        let finalName = name + params + ':' + returnType;
        if (input.action === ConduitRouteActions.GET && !this.queries.includes(finalName)) {
            this.queries += ' ' + finalName;
        } else if (input.action !== ConduitRouteActions.GET && !this.mutations.includes(finalName)) {
            this.mutations += ' ' + finalName;
        }
        return name;
    }

    generateQuerySchema() {
        if (this.queries.length > 1) {
            return 'type Query { ' + this.queries + ' }'
        }
        return '';
    }

    generateMutationSchema() {
        if (this.mutations.length > 1) {
            return 'type Mutation { ' + this.mutations + ' }'
        } else {
            return '';
        }
    }

    generateSchema() {
        this.typeDefs = this.types + ' ' + this.generateQuerySchema() + ' ' + this.generateMutationSchema();
    }

    shouldPopulate(args: any, info: any) {
        let resolveInfo = parseResolveInfo(info);
        let result = findPopulation(resolveInfo.fieldsByTypeName, this._relationTypes);
        if (result) {
            args['populate'] = result;
        }
        return args;
    }

    registerConduitRoute(route: ConduitRoute) {
        this.generateType(route.returnTypeName, route.returnTypeFields);
        let actionName = this.generateAction(route.input, route.returnTypeName);
        this.generateSchema();
        const self = this;
        if (route.input.action === ConduitRouteActions.GET) {
            if (!this.resolvers['Query']) {
                this.resolvers['Query'] = {};
            }
            this.resolvers['Query'][actionName] = (parent: any, args: any, context: any, info: any) => {
                args = self.shouldPopulate(args, info);
                return route.executeRequest({context: context, params: args}).then(r => {
                    return typeof route.returnTypeFields === 'string' ? {result: r} : r;
                })
            }
        } else {
            if (!this.resolvers['Mutation']) {
                this.resolvers['Mutation'] = {};
            }
            this.resolvers['Mutation'][actionName] = (parent: any, args: any, context: any, info: any) => {
                return route.executeRequest({context: context, params: args}).then(r => {
                    return typeof route.returnTypeFields === 'string' ? {result: r} : r;
                })
            }
        }
        this.refreshGQLServer();
    }


}
