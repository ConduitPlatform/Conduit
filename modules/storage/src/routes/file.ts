import File from '../models/File';
import {FileHandlers} from '../handlers/file';
import {IStorageProvider} from '@conduit/storage-provider';
import ConduitGrpcSdk from '@conduit/grpc-sdk';

export class FileRoutes {
    private readonly fileHandlers: FileHandlers;

    constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly storageProvider: IStorageProvider) {
        this.fileHandlers = new FileHandlers(grpcSdk, storageProvider);
        this.registerMiddleware();
        // this.registerRoutes();
    }

    private registerMiddleware() {
        // const authMiddleware = this.sdk.getAuthentication().middleware;
        // const router = this.sdk.getRouter();

        // router.registerRouteMiddleware('/storage/file', authMiddleware);
    }
    //
    // private registerRoutes() {
    //     const router = this.sdk.getRouter();
    //     router.registerRoute(new ConduitRoute({
    //             bodyParams: {
    //                 name: TYPE.String,
    //                 mimeType: TYPE.String,
    //                 data: TYPE.String,
    //                 folder: TYPE.String
    //             },
    //             action: ConduitRouteActions.POST,
    //             path: '/storage/file'
    //         }, new ConduitRouteReturnDefinition('File', {
    //             _id: TYPE.String,
    //             name: TYPE.String,
    //             user: TYPE.ObjectId, // Hack because we don't have endpoints that return a user so the model is not defined TODO replace with relation
    //             mimeType: TYPE.String,
    //             folder: TYPE.String,
    //             createdAt: TYPE.String,
    //             updatedAt: TYPE.String
    //         }),
    //         this.fileHandlers.createFile.bind(this.fileHandlers)));
    //
    //     router.registerRoute(new ConduitRoute({
    //             queryParams: {
    //                 id: TYPE.String
    //             },
    //             action: ConduitRouteActions.GET,
    //             path: '/storage/file' // TODO we need to change this to /storage/file/:id once path params work in the router
    //         }, new ConduitRouteReturnDefinition('FileWithData', {
    //             _id: TYPE.String,
    //             name: TYPE.String,
    //             user: TYPE.ObjectId,
    //             mimeType: TYPE.String,
    //             folder: TYPE.String,
    //             createdAt: TYPE.String,
    //             updatedAt: TYPE.String,
    //             data: TYPE.String
    //         }),
    //         this.fileHandlers.getFile.bind(this.fileHandlers)));
    //
    //     router.registerRoute(new ConduitRoute({
    //         queryParams: {
    //             id: TYPE.String
    //         },
    //         action: ConduitRouteActions.DELETE,
    //         path: '/storage/file'
    //     }, new ConduitRouteReturnDefinition('FileDeleteResponse', {
    //         success: TYPE.Boolean
    //     }), this.fileHandlers.deleteFile.bind(this.fileHandlers)));
    //
    //     router.registerRoute(new ConduitRoute({
    //         queryParams: {
    //             id: TYPE.String
    //         },
    //         bodyParams: {
    //             name: TYPE.String,
    //             mimeType: TYPE.String,
    //             data: TYPE.String,
    //             folder: TYPE.String
    //         },
    //         action: ConduitRouteActions.UPDATE,
    //         path: '/storage/file'
    //     }, new ConduitRouteReturnDefinition('FileUpdateResponse', {
    //         _id: TYPE.String,
    //         name: TYPE.String,
    //         user: TYPE.ObjectId,
    //         mimeType: TYPE.String,
    //         folder: TYPE.String,
    //         createdAt: TYPE.String,
    //         updatedAt: TYPE.String
    //     }), this.fileHandlers.updateFile.bind(this.fileHandlers)));
    // }

}
