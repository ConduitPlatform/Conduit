import { ConduitSchema } from "@quintessential-sft/conduit-grpc-sdk";
import schema from "../../models/schemaDefinitions.schema";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { CmsRoutes } from "../../routes/Routes";
import { compareFunction, getOps, sortAndConstructRoutes } from "./utils";
import { isNil } from "lodash";

export class SchemaController {
  private _adapter: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private router: CmsRoutes,
    private readonly stateActive: boolean
  ) {
    this._adapter = this.grpcSdk.databaseProvider!;
    this.loadExistingSchemas();
    if (stateActive) {
      this.initializeState();
    }
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe("cms", (message: string) => {
      if (message === "schema") {
        this.refreshRoutes();
      }
    });
  }

  private async loadExistingSchemas() {
    let schemaDefinitions = await this._adapter.createSchemaFromAdapter(schema);
    this._adapter
      .findMany("SchemaDefinitions", { enabled: true })
      .then((r: any) => {
        let promise = new Promise((resolve, reject) => {
          resolve("ok");
        });
        if (r) {
          r.forEach((r: any) => {
            if (typeof r.modelOptions === "string") {
              r.modelOptions = JSON.parse(r.modelOptions);
            }
            const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
            promise = promise.then((r) => {
              return this._adapter.createSchemaFromAdapter(schema);
            });
          });
          promise.then((p) => {
            let routeSchemas: any = {};
            r.forEach((schema: any) => {
              if (typeof schema.modelOptions === "string") {
                schema.modelOptions = JSON.parse(schema.modelOptions);
              }
              if (schema.name !== "SchemaDefinitions" && (schema.crudOperations || isNil(schema.crudOperations))) {
                routeSchemas[schema.name] = schema;
              }
            });
            this._registerRoutes(routeSchemas);
            this.router.requestRefresh();
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
            if (typeof schema.modelOptions === "string") {
              schema.modelOptions = JSON.parse(schema.modelOptions);
            }
            if (schema.name !== "SchemaDefinitions" && (schema.crudOperations || isNil(schema.crudOperations))) {
              routeSchemas[schema.name] = schema;
            }
          });
          this._registerRoutes(routeSchemas);
          this.router.requestRefresh();
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
    this._adapter
      .createSchemaFromAdapter(schema)
      .then((r:any) => {
        if (this.stateActive) {
          this.grpcSdk.bus?.publish("cms", "schema");
        }
        this.refreshRoutes();
      })
      .catch((err: any) => {
        console.log("Failed to create schema for cms");
        console.log(err);
      });
  }

  private _registerRoutes(schemas: { [name: string]: any }) {
    this.router.addRoutes(sortAndConstructRoutes(schemas));
  }
}
