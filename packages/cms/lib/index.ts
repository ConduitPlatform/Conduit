import schema from "./interfaces/schema";

export class CMS {

    _adapter: any;
    _schemas: any[];
    _router: any;

    constructor(databaseAdapter: any, router: any) {
        this._schemas = [];
        this._router = router;
        this._adapter = databaseAdapter;
        this._adapter.createSchemaFromAdapter(schema);
        this.loadExistingSchemas();
        this.constructRouter();
    }

    private loadExistingSchemas() {
        this._adapter.getSchema('SchemaDefinitions')
            .find({})
            .then((r: any) => {
                if (r) {
                    r.forEach((r: any) => {
                        let model = this._adapter.createSchemaFromAdapter(r);
                        this._schemas.push({
                            [r.name]: model
                        });
                    })
                }

            })
            .catch((err: Error) => {
                console.error("Something went wrong when loading schemas for cms");
                console.error(err);
            })
    }

    createSchema(name: string, properties: any) {
        let schema: any = {};
        schema['name'] = name;
        schema['schema'] = properties;
        let model = this._adapter.createSchemaFromAdapter(schema);
        this._schemas.push({
            [name]: model
        });
    }

    constructRouter() {
        // should support query params for multiple filters, finding by id and paging
        this._router.get('/content/:name', (req: any, res: any, next: any) => {
            //todo change to more robust mechanism
            this._schemas[req.params.name]
                .find({})
                .then((r: any) => {
                    if (r) {
                        res.status(200).json(r);
                    } else {
                        res.status(404).json({message: "Not found"});
                    }
                })
                .catch((err: Error) => {
                    res.status(500).json({message: "Something went wrong, view logs for details"});
                    console.error(err);
                })

        });

        // should support body for creating models
        this._router.post('/content/:name', (req: any, res: any, next: any) => {

        });


        // should support body for updating models, query params for finding them or optional id
        this._router.put('/content/:name', (req: any, res: any, next: any) => {

        });

        // should support query params for filtering them or optional id
        this._router.delete('/content/:name/', (req: any, res: any, next: any) => {

        });
    }

}



