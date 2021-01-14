import {NextFunction, Request, Response} from 'express';
import {ClientModel} from './models/Client';
import {isNil} from 'lodash';
import {ConduitSDK, IConduitSecurity, ConduitError} from '@quintessential-sft/conduit-sdk';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import {Admin} from './admin';
import helmet from "helmet";
import {RateLimiter} from "./handlers/rate-limiter";

class SecurityModule extends IConduitSecurity {

    private readonly database: any;
    conduit: ConduitSDK;

    constructor(conduit: ConduitSDK, grpcSdk: ConduitGrpcSdk) {
        super(conduit);

        this.conduit = conduit;
        this.database = grpcSdk.databaseProvider!;
        this.database.createSchemaFromAdapter(ClientModel);

        new Admin(this.conduit, grpcSdk);

        const router = conduit.getRouter();

        router.registerGlobalMiddleware('rateLimiter', (new RateLimiter(process.env.REDIS_HOST as string,
            parseInt(process.env.REDIS_PORT as string))).limiter);
        router.registerGlobalMiddleware('clientMiddleware', this.clientMiddleware.bind(this));
        router.registerGlobalMiddleware('helmetMiddleware', helmet());

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
