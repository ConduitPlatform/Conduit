import {NextFunction, Request, Response} from 'express';
import {ClientModel} from './models/Client';
import {isNil} from 'lodash';
import {ConduitSDK, IConduitSecurity, PlatformTypesEnum, ConduitError} from '@quintessential-sft/conduit-sdk';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

class SecurityModule extends IConduitSecurity {

    private readonly database: any;
    conduit: ConduitSDK;

    constructor(conduit: ConduitSDK, grpcSdk: ConduitGrpcSdk) {
        super(conduit);

        this.conduit = conduit;
        this.database = grpcSdk.databaseProvider!;
        this.database.createSchemaFromAdapter(ClientModel);

        conduit.getAdmin().registerRoute('POST', '/client',
            async (req: Request, res: Response, next: NextFunction) => {
                const {clientId, clientSecret, platform} = req.body;

                if (!Object.values(PlatformTypesEnum).includes(platform)) {
                    return res.status(401).json({error: 'Invalid platform'});
                }

                await this.database.create('Client', {
                    clientId,
                    clientSecret,
                    platform
                });

                return res.json({message: 'Client created'});
            });

        const router = conduit.getRouter();

        router.registerGlobalMiddleware('clientMiddleware', this.clientMiddleware.bind(this));
    }

    clientMiddleware(req: Request, res: Response, next: NextFunction) {
        if (isNil((req as any).conduit)) (req as any).conduit = {};
        if (req.path.indexOf('/hook') === 0 || req.path.indexOf('/admin') === 0) {
            return next();
        }

        if ((req.url === '/graphql' || req.url.startsWith('/swagger')) && req.method === 'GET') {
            return next();
        }

        const {clientid, clientsecret} = req.headers;
        if (isNil(clientid) || isNil(clientsecret)) {
            return next(ConduitError.unauthorized());
        }

        this.database
            .findOne('Client', {clientId: clientid, clientSecret: clientsecret})
            .then((client: any) => {
                if (isNil(client)) {
                    throw ConduitError.unauthorized();
                }
                delete req.headers.clientsecret;
                (req as any).conduit.clientId = clientid;
                next();
            })
            .catch(next);
    }

}

export = SecurityModule;
