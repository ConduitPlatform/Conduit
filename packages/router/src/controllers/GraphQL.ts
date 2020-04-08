// todo Create the controller that creates GraphQL-specific endpoints
import {filter, find} from "lodash";
import {Application} from "express";

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

export class GraphQLController {
    constructor(app: Application) {
        const server = new ApolloServer({
            typeDefs,
            resolvers,
        });
        let middle = server.getMiddleware();
        app.use('/', middle);
    }
}
