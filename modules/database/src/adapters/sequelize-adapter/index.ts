import { DatabaseAdapter } from "../../interfaces/DatabaseAdapter";
import { Sequelize } from "sequelize";
import { SequelizeSchema } from "./SequelizeSchema";
import { schemaConverter } from "./SchemaConverter";
import { ConduitSchema } from "@quintessential-sft/conduit-grpc-sdk";
import { systemRequiredValidator } from "../utils/validateSchemas";

export class SequelizeAdapter implements DatabaseAdapter {
  connected: boolean = false;
  connectionUri: string;
  sequelize: Sequelize;
  models: { [name: string]: SequelizeSchema };
  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionUri: string) {
    this.registeredSchemas = new Map();
    this.connectionUri = connectionUri;
    this.sequelize = new Sequelize(this.connectionUri);
  }

  createSchemaFromAdapter(schema: any): Promise<{ schema: any; }> {
    if (!this.models) {
      this.models = {};
    }

    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== "Config") {
        try {
          schema = systemRequiredValidator(this.registeredSchemas.get(schema.name)!, schema);
        } catch (err) {
          return Promise.reject(err);
        }
      }
      delete this.sequelize.models[schema.name];
    }

    let newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new SequelizeSchema(this.sequelize, newSchema);
    return this.syncDb().then(() => {return { schema: this.models![schema.name] }});
  }

  private async syncDb() {
    await this.sequelize.sync().catch(console.error);
  }

  async getSchema(schemaName: string): Promise<{ schema: any; }> {
    if (this.models) {
      return { schema: this.models[schemaName].originalSchema };
    }
    throw new Error("Schema not defined yet");
  }

  async getSchemaModel(schemaName: string): Promise<{ model: any; }> {
    if (this.models) {
      return { model: this.models[schemaName] };
    }
    throw new Error("Schema not defined yet");
  }

  async ensureConnected(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.sequelize.authenticate()
        .then(() => {
          console.log("Sequelize connection established successfully");
          resolve();
        })
        .catch((err: any) => {
          console.error("Unable to connect to the database: ", err);
          reject();
        })
    });
  }
}
