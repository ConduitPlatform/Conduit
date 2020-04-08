import {Request, Response, NextFunction, Application} from 'express';
import {ClientModel} from './models/Client';
import {isNil} from 'lodash';
import {PlatformTypesEnum} from './PlatformTypesEnum';

let initialized = false;
let database: any;

export const initialize = (app: Application | any) => {
    if (!app) {
        throw new Error("No app provided")
    }
    database = app.conduit.getDatabase();
    database.createSchemaFromAdapter(ClientModel);

    app.conduit.getAdmin().registerRoute('POST', '/client',
        async (req: Request, res: Response, next: NextFunction) => {
            const {clientId, clientSecret, platform} = req.body;

            if (!Object.values(PlatformTypesEnum).includes(platform)) {
                return res.status(401).json({error: 'Invalid platform'});
            }

            await database.getSchema('Client').create({
                clientId,
                clientSecret,
                platform
            });

            return res.json({message: 'Client created'});
        });

    return initialized = true;
};

export const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (!initialized) {
        throw new Error('Security module not initialized');
    }
    if (req.path.indexOf('/hook/') === 0 || req.path.indexOf('/admin/') === 0) {
        return next();
    }

    if (req.path.indexOf('/graphql') === 0 && req.method === 'GET') {
        return next();
    }

    const {clientid, clientsecret} = req.headers;
    if (isNil(clientid) || isNil(clientsecret)) {
        return res.status(401).json({error: 'Unauthorized'});
    }

    database.getSchema('Client')
        .findOne({clientId: clientid, clientSecret: clientsecret})
        .then(async (client: any) => {
            if (isNil(client)) {
                return res.status(401).json({error: 'Unauthorized'});
            }
            delete req.headers.clientsecret;
            next();
        })
        .catch(next);
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!initialized) {
        throw new Error('Security module not initialized');
    }
    if (req.path.indexOf('/admin/') !== 0) {
        return next();
    }

    const masterkey = req.headers.masterkey;
    if (isNil(masterkey) || masterkey !== (req.app as any).conduit.config.get('admin.auth.masterkey'))
        return res.status(401).json({error: 'Unauthorized'});

    return next();
};

export * from './PlatformTypesEnum';
