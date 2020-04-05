import {Application, NextFunction, Router, Request, Response} from "express";
import {RouteBuilder} from "./builders/RouteBuilder";
import {RouterBuilder} from "./builders/RouterBuilder";
import {find, filter} from "lodash";

const {
    parseResolveInfo,
} = require('graphql-parse-resolve-info');
const {ApolloServer, gql} = require('apollo-server-express');

const typeDefs = `
  type Author {
    id: Int!
    firstName: String
    lastName: String
    """
    the list of Posts by this author
    """
    posts: [Post]
  }

  type Post {
    id: Int!
    title: String
    author: Author
    votes: Int
  }

  # the schema allows the following query:
  type Query {
    posts: [Post]
    author(id: Int!): Author
  }

  # this schema allows the following mutation:
  type Mutation {
    upvotePost (
      postId: Int!
    ): Post
  }
`;
// example data
const authors = [
    {id: 1, firstName: 'Tom', lastName: 'Coleman'},
    {id: 2, firstName: 'Sashko', lastName: 'Stubailo'},
    {id: 3, firstName: 'Mikhail', lastName: 'Novikov'},
];

const posts = [
    {id: 1, authorId: 1, title: 'Introduction to GraphQL', votes: 2},
    {id: 2, authorId: 2, title: 'Welcome to Meteor', votes: 3},
    {id: 3, authorId: 2, title: 'Advanced GraphQL', votes: 1},
    {id: 4, authorId: 3, title: 'Launchpad is Cool', votes: 7},
];

const resolvers = {
    Query: {
        posts: () => posts,
        author: (_: any, {id}: any) => find(authors, {id}),
    },

    Mutation: {
        upvotePost: (_: any, {postId}: any) => {
            const post = find(posts, {id: postId});
            if (!post) {
                throw new Error(`Couldn't find post with id ${postId}`);
            }
            post.votes += 1;
            return post;
        },
    },

    Author: {
        posts: (author: any, args: any, context: any, info: any) => {
            console.log(parseResolveInfo(info));
            let resolveInfo = parseResolveInfo(info);
            let keys = Object.keys(resolveInfo.fieldsByTypeName['Post']);
            if (keys.length === 1 && keys[0] === 'id') {
                console.log("Would return id only");
            } else {
                console.log("Would return full object")
            }
            return filter(posts, {authorId: author.id})
        },
    },

    Post: {
        author: (post: any) => find(authors, {id: post.authorId}),
    },
};

export class ConduitRouter {

    private static _instance: ConduitRouter;
    private _app: Application;
    private _globalMiddlewares: string[];
    private _routes: any[];

    private constructor(app: Application) {
        this._app = app;
        this._routes = [];
        this._globalMiddlewares = [];
        const server = new ApolloServer({
            typeDefs,
            resolvers,
        });

        server.applyMiddleware({app});
    }

    static getInstance(app: Application) {
        if (!this._instance && app) {
            this._instance = new ConduitRouter(app);
            return this._instance;
        } else if (this._instance) {
            return this._instance
        } else {
            throw new Error("No settings provided to initialize");
        }
    }

    registerGlobalMiddleware(name: string, middleware: any) {
        this._globalMiddlewares.push(name);
        this._app.use(middleware);
    }

    getGlobalMiddlewares(): string[] {
        return this._globalMiddlewares;
    }

    hasGlobalMiddleware(name: string): boolean {
        return this._globalMiddlewares.indexOf(name) !== -1;
    }

    registerRouter(routerBuilder: RouterBuilder) {
        let {name, router} = routerBuilder.construct();
        this._routes.push(name);
        this._app.use(name, router);
    }

    registerExpressRouter(name: string, router: Router) {
        this._routes.push(name);
        this._app.use(name, router);
    }

    registerDirectRouter(name: string, router: (req: Request, res: Response, next: NextFunction) => void) {
        this._routes.push(name);
        this._app.use(name, router);
    }

    getRegisteredRoutes() {
        return this._routes;
    }


}


export let route = RouteBuilder;
export let router = RouterBuilder;



