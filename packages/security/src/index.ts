import {NextFunction, Request, Response} from 'express';
import {ClientModel} from './models/Client';
import {isNil} from 'lodash';
import {ConduitRouteParameters, ConduitSDK, IConduitDatabase, IConduitSecurity, PlatformTypesEnum} from '@conduit/sdk';

class SecurityModule extends IConduitSecurity {

    private readonly database: IConduitDatabase;
    conduit: ConduitSDK;

    constructor(conduit: ConduitSDK) {
        super(conduit);

        this.conduit = conduit;
        this.database = conduit.getDatabase();
        this.database.createSchemaFromAdapter(ClientModel);

        conduit.getAdmin().registerRoute('POST', '/client',
            async (req: Request, res: Response, next: NextFunction) => {
                const {clientId, clientSecret, platform} = req.body;

                if (!Object.values(PlatformTypesEnum).includes(platform)) {
                    return res.status(401).json({error: 'Invalid platform'});
                }

                await this.database.getSchema('Client').create({
                    clientId,
                    clientSecret,
                    platform
                });

                return res.json({message: 'Client created'});
            });

        const router = conduit.getRouter();

        router.registerGlobalMiddleware('authMiddleware', (req: Request, res: Response, next: NextFunction) => this.authMiddleware(req, res, next));

        router.registerRouteMiddleware('/admin', this.adminMiddleware);
    }

    authMiddleware(req: Request, res: Response, next: NextFunction) {
        if (req.path.indexOf('/hook/') === 0 || req.path.indexOf('/admin') === 0) {
            return next();
        }

        if (req.path.indexOf('/graphql') === 0 && req.method === 'GET') {
            return next();
        }

        const {clientid, clientsecret} = req.headers;
        if (isNil(clientid) || isNil(clientsecret)) {
            return res.status(401).json({error: 'Unauthorized'});
        }

        this.database.getSchema('Client')
            .findOne({clientId: clientid, clientSecret: clientsecret})
            .then(async (client: any) => {
                if (isNil(client)) {
                    return res.status(401).json({error: 'Unauthorized'});
                }
                delete req.headers.clientsecret;
                next();
            })
            .catch(next);
    }


    adminMiddleware(context: ConduitRouteParameters) {
        return new Promise((resolve, reject) => {
            const masterkey = context.headers.masterkey;
            if (isNil(masterkey) || masterkey !== (this.conduit as any).config.get('admin.auth.masterkey'))
                // todo find a way to bring this back
                //res.status(401).json({error: 'Unauthorized'});
                throw new Error("Unauthorized")
            resolve("ok");
        })
    }
}

export = SecurityModule;
