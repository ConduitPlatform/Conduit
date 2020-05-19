// import {isNil} from 'lodash';
// import {
//     ConduitRouteParameters,
//     ConduitSDK,
//     IConduitDatabase,
//     ConduitError
// } from '@conduit/sdk';
// import {AuthService} from '../services/auth';
// import ConduitGrpcSdk from '@conduit/grpc-sdk';
//
// export class AuthMiddleware {
//     private readonly database: any;
//
//     constructor(
//         private readonly grpcSdk: ConduitGrpcSdk
//     ) {
//         this.database = grpcSdk.databaseProvider;
//     }
//
//     middleware(request: ConduitRouteParameters): Promise<any> {
//         return new Promise((resolve, reject) => {
//             const header = (request.headers['Authorization'] || request.headers['authorization']) as string;
//             if (isNil(header)) {
//                 throw ConduitError.unauthorized();
//             }
//             const args = header.split(' ');
//
//             const prefix = args[0];
//             if (prefix !== 'Bearer') {
//                 throw ConduitError.unauthorized();
//             }
//
//             const token = args[1];
//             if (isNil(token)) {
//                 throw ConduitError.unauthorized();
//             }
//
//             resolve(this.database.findOne('AccessToken',{token, clientId: (request as any).context.clientId}))
//         }).then((accessTokenDoc: any) => {
//             if (isNil(accessTokenDoc)) {
//                 throw ConduitError.unauthorized();
//             }
//
//             return this.database.findOne('User',{_id: accessTokenDoc.userId})
//         })
//             .then(user => {
//                 if (isNil(user)) {
//                     throw ConduitError.notFound('User not found');
//                 }
//                 (request as any).context.user = user;
//                 return "ok";
//             });
//
//     }
// }
