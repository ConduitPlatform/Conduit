import {ConduitSchema} from "@quintessential-sft/conduit-grpc-sdk";
import schema from "../models/schema";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import {CmsRoutes} from "../routes/Routes";

export class SchemaController {

    private _schemas: { [name: string]: any } = {}; // used to be SchemaAdapter
    private _adapter: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk, private router: CmsRoutes) {
        this._adapter = this.grpcSdk.databaseProvider!;
        this.loadExistingSchemas();
    }

    private async loadExistingSchemas() {
        this._schemas['SchemaDefinitions'] = await this._adapter.createSchemaFromAdapter(schema);
        this._adapter
            .findMany('SchemaDefinitions', {enabled: true})
            .then((r: any) => {
                let promise = new Promise((resolve, reject) => {
                    resolve();
                });
                if (r) {
                    r.forEach((r: any) => {
                        if (typeof r.modelOptions === 'string') {
                            r.modelOptions = JSON.parse(r.modelOptions);
                        }
                        const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
                        promise = promise.then(r => {
                            return this._adapter.createSchemaFromAdapter(schema)
                        }).then(p => {
                            this._schemas[r.name] = p;
                        })

                    })
                    promise.then(r => {
                        this.router.refreshRoutes(this._schemas);
                    })

                }

            })
            .catch((err: Error) => {
                console.error("Something went wrong when loading schema for cms");
                console.error(err);
            })
    }

    monitorSchemas() {

    }

    getActiveSchemas() {

    }

    createSchema(schema: ConduitSchema): void {
        this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
    }


}
