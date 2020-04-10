// todo Create the controller that creates GraphQL-specific endpoints
import {Application, Request} from "express";
import {ConduitModel, ConduitRoute, ConduitRouteActions, ConduitRouteOption, ConduitRouteOptions} from "@conduit/sdk";
import {extractTypes} from "./TypeUtils";

const {
    parseResolveInfo,
} = require('graphql-parse-resolve-info');
const {ApolloServer, gql} = require('apollo-server-express');

// const typeDefs = `
//   type Author {
//     id: Int!
//     firstName: String
//     lastName: String
//     """
//     the list of Posts by this author
//     """
//     posts: [Post]
//   }
//
//   type Post {
//     id: Int!
//     title: String
//     author: Author
//     votes: Int
//   }
//
//   # the schema allows the following query:
//   type Query {
//     posts: [Post]
//     author(id: Int!): Author
//   }
//
//   # this schema allows the following mutation:
//   type Mutation {
//     upvotePost (
//       postId: Int!
//     ): Post
//   }
// `;
// example data
// const authors = [
//     {id: 1, firstName: 'Tom', lastName: 'Coleman'},
//     {id: 2, firstName: 'Sashko', lastName: 'Stubailo'},
//     {id: 3, firstName: 'Mikhail', lastName: 'Novikov'},
// ];
//
// const posts = [
//     {id: 1, authorId: 1, title: 'Introduction to GraphQL', votes: 2},
//     {id: 2, authorId: 2, title: 'Welcome to Meteor', votes: 3},
//     {id: 3, authorId: 2, title: 'Advanced GraphQL', votes: 1},
//     {id: 4, authorId: 3, title: 'Launchpad is Cool', votes: 7},
// ];
//
// const resolvers = {
//     Query: {
//         posts: () => posts,
//         author: (_: any, {id}: any) => find(authors, {id}),
//     },
//
//     Mutation: {
//         upvotePost: (_: any, {postId}: any) => {
//             const post = find(posts, {id: postId});
//             if (!post) {
//                 throw new Error(`Couldn't find post with id ${postId}`);
//             }
//             post.votes += 1;
//             return post;
//         },
//     },
//
//     Author: {
//         posts: (author: any, args: any, context: any, info: any) => {
//             console.log(parseResolveInfo(info));
//             let resolveInfo = parseResolveInfo(info);
//             let keys = Object.keys(resolveInfo.fieldsByTypeName['Post']);
//             if (keys.length === 1 && keys[0] === 'id') {
//                 console.log("Would return id only");
//             } else {
//                 console.log("Would return full object")
//             }
//             return filter(posts, {authorId: author.id})
//         },
//     },
//
//     Post: {
//         author: (post: any) => find(authors, {id: post.authorId}),
//     },
// };
export class GraphQLController {

    typeDefs: string;
    types: string;
    queries: string;
    mutations: string;
    resolvers: any;
    private apollo?: any;

    constructor(app: Application) {
        this.resolvers = {};
        this.typeDefs = ``;
        this.types = '';
        this.queries = '';
        this.mutations = '';
        const self = this;
        app.use('/', (req, res, next) => {
            if (self.apollo) {
                self.apollo(req, res, next)
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

        this.apollo = server.getMiddleware();
    }

    generateType(name: string, fields: ConduitModel | string) {
        if (this.typeDefs.includes(name)) {
            return;
        }
        this.types += extractTypes(name, fields);
    }

    generateAction(input: ConduitRouteOptions, returnType: string) {
        let pathName: any = input.path.split('/');
        pathName = pathName[pathName.length - 1];
        pathName = pathName.slice(0, 1).toUpperCase() + pathName.slice(1);
        let name = input.action.toLowerCase() + pathName

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
        } else {
            return '';
        }
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

    registerConduitRoute(route: ConduitRoute) {
        this.generateType(route.returnTypeName, route.returnTypeFields);
        let actionName = this.generateAction(route.input, route.returnTypeName);
        this.generateSchema();
        if (route.input.action === ConduitRouteActions.GET) {
            if (!this.resolvers['Query']) {
                this.resolvers['Query'] = {};
            }
            this.resolvers['Query'][actionName] = (parent: any, args: any, context: any, info: any) => {
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
