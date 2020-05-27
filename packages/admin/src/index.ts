import {isNil} from 'lodash';
import {hashPassword, verifyToken} from './utils/auth';
import {Router, Handler, Request, Response, NextFunction} from 'express';
import {AuthHandlers} from './handlers/auth';
import {AdminSchema} from './models/Admin';
import {ConduitError, ConduitRouteParameters, ConduitSDK, IConduitAdmin} from '@conduit/sdk';
import AdminConfigSchema from './config/admin';
import * as grpc from "grpc";

let protoLoader = require('@grpc/proto-loader');
import fs from 'fs';
import path from 'path';
import ConduitGrpcSdk from '@conduit/grpc-sdk';

export default class AdminModule extends IConduitAdmin {
    private readonly router: Router;
    conduit: ConduitSDK;
    grpcSdk: ConduitGrpcSdk;

    constructor(grpcSdk: ConduitGrpcSdk, conduit: ConduitSDK, server: grpc.Server, packageDefinition: any) {
        super(conduit);
        this.conduit = conduit;
        this.grpcSdk = grpcSdk;
        this.router = Router();

        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

        //grpc stuff
        // @ts-ignore
        let admin = protoDescriptor.conduit.core.Admin;
        server.addService(admin.service, {
            registerAdminRoute: this.registerAdminRoute.bind(this),
        })
    }

    async initialize() {
        await this.conduit.getConfigManager().registerModulesConfigSchema(AdminConfigSchema);
        await this.handleDatabase().catch(console.log);
        const adminHandlers = new AuthHandlers(this.grpcSdk, this.conduit);
        this.conduit.getRouter().registerDirectRouter('/admin/login',
            (req: Request, res: Response, next: NextFunction) => adminHandlers.loginAdmin(req, res, next).catch(next));
        this.conduit.getRouter().registerRouteMiddleware('/admin', this.adminMiddleware);
        this.router.use((req, res, next) => this.authMiddleware(req, res, next));
        this.conduit.getRouter().registerExpressRouter('/admin', this.router);

    }

    // @ts-ignore
    private async handleDatabase() {
        if (!this.grpcSdk.databaseProvider) {
            await this.grpcSdk.waitForExistence('database-provider');
        }
        const databaseAdapter = this.grpcSdk.databaseProvider!;

        await databaseAdapter.createSchemaFromAdapter(AdminSchema);

        databaseAdapter.findOne('Admin', {username: 'admin'})
            .then(async (existing: any) => {
                if (isNil(existing)) {
                    const adminConfig = await this.grpcSdk.config.get('admin');
                    const hashRounds = adminConfig.auth.hashRounds;
                    return hashPassword('admin', hashRounds);
                }
                return Promise.resolve(null);
            })
            .then((result: string | null) => {
                if (!isNil(result)) {
                    return databaseAdapter.create('Admin', {username: 'admin', password: result});
                }
            })
            .catch(console.log);
    }

    //grpc
    registerAdminRoute(call: any, callback: any) {
        let protofile = call.request.protoFile
        let routes: [{ path: string, method: string, grpcFunction: string }] = call.request.routes;
        let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
        fs.writeFileSync(protoPath, protofile);
        var packageDefinition = protoLoader.loadSync(
            protoPath,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        let adminDescriptor: any = grpc.loadPackageDefinition(packageDefinition);
        //this can break everything change it
        while (Object.keys(adminDescriptor)[0] !== 'Admin') {
            adminDescriptor = adminDescriptor[Object.keys(adminDescriptor)[0]];
        }
        adminDescriptor = adminDescriptor[Object.keys(adminDescriptor)[0]];
        let serverIp = call.request.adminUrl;
        let client = new adminDescriptor(serverIp, grpc.credentials.createInsecure())
        routes.forEach(r => {
            let handler = (req: any, res: any, next: any) => {
                const context = (req as any).conduit;
                let params: any = {}
                if (req.query) {
                    Object.assign(params, req.query);
                }
                if (req.body) {
                    Object.assign(params, req.body);
                }
                if (req.params) {
                    Object.assign(params, req.params);
                }
                if (params.populate) {
                    if (params.populate.includes(',')) {
                        params.populate = params.populate.split(',');
                    } else {
                        params.populate = [params.populate];
                    }
                }
                let request = {
                    params: JSON.stringify(params),
                    header: JSON.stringify(req.headers),
                    context: JSON.stringify(context)
                }
                client[r.grpcFunction](request, (err: any, result: any) => {
                    if (err) {
                        return res.status(500).send(err);
                    }
                    res.status(200).json(JSON.parse(result.result));
                });
            }
            this.registerRoute(r.method, r.path, handler)
        })
        //perhaps wrong(?) we send an empty response
        callback(null, null);
    }

    registerRoute(method: string, route: string, handler: Handler) {
        switch (method) {
            case 'GET':
                this.router.get(route, handler);
                break;
            case 'POST':
                this.router.post(route, handler);
                break;
            case 'PUT':
                this.router.put(route, handler);
                break;
            case 'DELETE':
                this.router.delete(route, handler);
                break;
            default:
                this.router.get(route, handler);
        }
    }

    async authMiddleware(req: Request, res: Response, next: NextFunction) {

        const databaseAdapter = await this.grpcSdk.databaseProvider!;
        const adminConfig = await this.grpcSdk.config.get('admin');

        const tokenHeader = req.headers.authorization;
        if (isNil(tokenHeader)) {
            return res.status(401).json({error: 'No token provided'});
        }

        const args = tokenHeader.split(' ');
        if (args.length !== 2) {
            return res.status(401).json({error: 'Invalid token'});
        }

        const [prefix, token] = args;
        if (prefix !== 'JWT') {
            return res.status(401).json({error: 'The authorization header must begin with JWT'});
        }
        let decoded;
        try {
            decoded = verifyToken(token, adminConfig.auth.tokenSecret);
        } catch (error) {
            return res.status(401).json({error: 'Invalid token'});
        }
        const {id} = decoded;

        databaseAdapter.findOne('Admin', {_id: id})
            .then((admin: any) => {
                if (isNil(admin)) {
                    return res.status(401).json({error: 'No such user exists'});
                }
                (req as any).admin = admin;
                next();
            })
            .catch((error: Error) => {
                console.log(error);
                res.status(500).json({error: 'Something went wrong'});
            });
    }

    async adminMiddleware(context: ConduitRouteParameters) {
        const adminConfig = await this.grpcSdk.config.get('admin');
        return new Promise((resolve, reject) => {
            const masterkey = context.headers.masterkey;
            if (isNil(masterkey) || masterkey !== adminConfig.auth.masterkey)
                throw new ConduitError('UNAUTHORIZED', 401, 'Unauthorized');
            resolve("ok");
        })
    }

}
