import { ConduitSchema } from "@quintessential-sft/conduit-grpc-sdk";
import schema from "../../models/schemaDefinitions.schema";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { CmsRoutes } from "../../routes/Routes";
import { compareFunction, getOps, sortAndConstructRoutes } from "./utils";

export class SchemaController {
  private _schemas: { [name: string]: any } = {}; // used to be SchemaAdapter
  private _adapter: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private router: CmsRoutes) {
    this._adapter = this.grpcSdk.databaseProvider!;
    this.loadExistingSchemas();
  }

  private async loadExistingSchemas() {
    this._schemas["SchemaDefinitions"] = await this._adapter.createSchemaFromAdapter(schema);
    this._adapter
      .findMany("SchemaDefinitions", { enabled: true })
      .then((r: any) => {
        let promise = new Promise((resolve, reject) => {
          resolve();
        });
        if (r) {
          r.forEach((r: any) => {
            if (typeof r.modelOptions === "string") {
              r.modelOptions = JSON.parse(r.modelOptions);
            }
            const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
            promise = promise
              .then((r) => {
                return this._adapter.createSchemaFromAdapter(schema);
              })
              .then((p) => {
                this._schemas[r.name] = p;
              });
          });
          promise.then((p) => {
            let routeSchemas: any = {};
            r.forEach((schema: any) => {
              routeSchemas[schema.name] = schema;
            });
            this._registerRoutes(routeSchemas);
          });
        }
      })
      .catch((err: Error) => {
        console.error("Something went wrong when loading schema for cms");
        console.error(err);
      });
  }

  refreshRoutes() {
    this._adapter
      .findMany("SchemaDefinitions", { enabled: true })
      .then((r: any) => {
        if (r) {
          let routeSchemas: any = {};
          r.forEach((schema: any) => {
            if (typeof r.modelOptions === "string") {
              r.modelOptions = JSON.parse(r.modelOptions);
            }
            routeSchemas[schema.name] = schema;
          });
          this._registerRoutes(routeSchemas);
        } else {
          console.error("Something went wrong when loading schema for cms");
          console.error("No schemas emitted");
        }
      })
      .catch((err: Error) => {
        console.error("Something went wrong when loading schema for cms");
        console.error(err);
      });
  }

  createSchema(schema: ConduitSchema): void {
    this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
    this.refreshRoutes();
  }

  private _registerRoutes(schemas: { [name: string]: any }) {
    let schemaCopy = Object.assign({}, schemas);
    delete schemaCopy["SchemaDefinitions"];
    if (Object.keys(schemaCopy).length === 0) {
      return;
    }
    this.router.addRoutes(sortAndConstructRoutes(schemaCopy));
  }
}
