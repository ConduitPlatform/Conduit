import {ConduitSDK, IConduitDatabase} from '@conduit/sdk';
import {Request, Response} from 'express';
import {isNil, merge} from 'lodash';

export class AdminHandlers {
    private readonly database: IConduitDatabase;

    constructor(private readonly sdk: ConduitSDK) {
        this.database = sdk.getDatabase();
        this.registerRoutes();
    }

    async getUsers(req: Request, res: Response) {
        const {skip, limit} = req.query;
        let skipNumber = 0, limitNumber = 25;

        if (!isNil(skip)) {
            skipNumber = Number.parseInt(skip as string);
        }
        if (!isNil(limit)) {
            limitNumber = Number.parseInt(limit as string);
        }

        const User = this.database.getSchema('User');
        const usersPromise = User.findPaginated({}, skipNumber, limitNumber);
        const countPromise = User.countDocuments({});
        const [users, count] = await Promise.all([usersPromise, countPromise]);

        return res.json({users, count});
    }

    async editAuthConfig(req: Request, res: Response) {
        const {config: appConfig} = this.sdk as any;

        const Config = this.database.getSchema('Config');

        const newAuthConfig = req.body;

        const dbConfig = await Config.findOne({});
        if (isNil(dbConfig)) {
            return res.status(404).json({error: 'Config not set'});
        }

        const currentAuthConfig = dbConfig.config.authentication;
        const final = merge(currentAuthConfig, newAuthConfig);

        dbConfig.config.authentication = final;
        const saved = await dbConfig.save();
        appConfig.load(saved.config);

        return res.json(saved.config.authentication);
    }

    async getAuthConfig(req: Request, res: Response) {
        const {config} = this.sdk as any;

        const authConfig = config.get('authentication');

        return res.json(authConfig);
    }

    registerRoutes() {
        this.sdk.getAdmin().registerRoute('GET', '/users',
            (req, res, next) => this.getUsers(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('PUT', '/authentication/config',
            (req, res, next) => this.editAuthConfig(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('GET', '/authentication/config',
            (req, res, next) => this.getAuthConfig(req, res).catch(next));
    }
}
