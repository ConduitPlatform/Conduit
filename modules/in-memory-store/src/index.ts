// import * as protoLoader from '@grpc/proto-loader';
import grpc from 'grpc';
import {InMemoryStore} from "./InMemoryStore";

// const PROTO_PATH = './in-memory-store.proto';
//
// // Suggested options for similarity to existing grpc.load behavior
// let packageDefinition = protoLoader.loadSync(
//     PROTO_PATH,
//     {
//         keepCase: true,
//         longs: String,
//         enums: String,
//         defaults: true,
//         oneofs: true
//     });
// let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
// var serviceDefinition = protoDescriptor.inmemorystore;
const server = new grpc.Server();
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
let store = new InMemoryStore();
server.start();


