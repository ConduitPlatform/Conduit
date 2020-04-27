import schema from './interfaces/schema';
import {
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSchema,
    ConduitSDK,
    IConduitCMS,
    IConduitDatabase,
    SchemaAdapter
} from '@conduit/sdk';
import { AdminHandlers } from './handlers/admin';

export class CMS extends IConduitCMS {

    private readonly _adapter: IConduitDatabase;
    private readonly _schemas: { [name: string]: SchemaAdapter };
    private readonly _router: any;
    private readonly sdk: ConduitSDK;


    constructor(conduit: ConduitSDK) {
        super(conduit);
        this._schemas = {};
        this.sdk = conduit;
        this._adapter = this.sdk.getDatabase();
        this._schemas['SchemaDefinitions'] = this._adapter.createSchemaFromAdapter(schema);
        this.loadExistingSchemas();
        this.constructAdminRoutes();
    }

    private loadExistingSchemas() {
        this._adapter.getSchema('SchemaDefinitions').model
            .find({})
            .then((r: any) => {
                if (r) {
                    r.forEach((r: any) => {
                        this._schemas[r.name] = this._adapter.createSchemaFromAdapter(r)
                        this.constructSchemaRoutes(this._schemas[r.name]);
                    })
                }

            })
            .catch((err: Error) => {
                console.error("Something went wrong when loading schema for cms");
                console.error(err);
            })
    }

    createSchema(schema: ConduitSchema): void {
        this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
        this.constructSchemaRoutes(this._schemas[schema.name]);
    }

    //todo add support for paginantion
    //todo add support for filtering
    constructSchemaRoutes(schema: SchemaAdapter) {
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/content/' + schema.originalSchema.name,
                action: Actions.GET
            },
            new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
            (params: ConduitRouteParameters) => {
                return schema.findMany({});
            }));

        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/content/' + schema.originalSchema.name,
                action: Actions.POST,
                bodyParams: schema.originalSchema.fields
            },
            new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
            (params: ConduitRouteParameters) => {
                let body = params.params;
                let context = params.context;
                // todo check if this is correct. Context was added here in case the create method needs the user for example
                return schema.create({...body, ...context});
            }));
        // todo PUT should be identical to POST but all fields should be made optional
        // this.sdk.getRouter().registerRoute(new ConduitRoute(
        //     {
        //         path: '/content/' + schema.originalSchema.name,
        //         action: Actions.POST,
        //         bodyParams: schema.originalSchema.fields
        //     },
        //     new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
        //     (params: ConduitRouteParameters) => {
        //         let body = params.params;
        //         let context = params.context;
        //         // todo check if this is correct. Context was added here in case the create method needs the user for example
        //         return schema.create({body, ...context});
        //     }));


    }

    constructAdminRoutes() {
        const adminHandlers = new AdminHandlers(this.sdk);

        this.sdk.getAdmin().registerRoute('GET', '/content/schemas',
          (req, res, next) => adminHandlers.getAllSchemas(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/content/schemas',
          (req, res, next) => adminHandlers.createSchema(req, res).catch(next));
    }
}



