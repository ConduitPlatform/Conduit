import { ConnectionOptions, Mongoose } from "mongoose";
import { MongooseSchema } from "./MongooseSchema";
import { schemaConverter } from "./SchemaConverter";
import { ConduitError, ConduitSchema } from "@quintessential-sft/conduit-grpc-sdk";
import { cloneDeep, isEmpty, isObject, isString, merge, isArray } from "lodash";

const deepdash = require("deepdash/standalone");

export class MongooseAdapter {
  connected: boolean = false;
  mongoose: Mongoose;
  connectionString: string;
  options: ConnectionOptions = {
    autoReconnect: true,
    keepAlive: true,
    connectTimeoutMS: 30000,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  };
  models?: { [name: string]: MongooseSchema };
  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionString: string) {
    this.registeredSchemas = new Map();
    this.connectionString = connectionString;
    this.mongoose = new Mongoose();
    this.mongoose.Promise = require("bluebird");
    this.connect();
  }

  async ensureConnected(): Promise<any> {
    return new Promise((resolve, reject) => {
      let db = this.mongoose.connection;
      db.on("connected", () => {
        console.log("MongoDB dashboard is connected");
        resolve();
      });

      db.on("error", (err: any) => {
        console.error("Dashboard Connection error:", err.message);
        reject();
      });

      db.once("open", function callback() {
        console.info("Connected to Dashboard Database!");
        resolve();
      });

      db.on("reconnected", function () {
        console.log("Dashboard Database reconnected!");
        resolve();
      });

      db.on("disconnected", function () {
        console.log("Dashboard Database Disconnected");
        reject();
      });
    });
  }

  connect() {
    this.mongoose
      .connect(this.connectionString, this.options)
      .then(() => {})
      .catch((err: any) => {
        console.log(err);
        throw new Error("Connection with Mongo not possible");
      });
  }

  createSchemaFromAdapter(schema: any): Promise<{ schema: any }> {
    const Schema = this.mongoose.Schema;
    if (!this.models) {
      this.models = {};
    }

    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== "Config") {
        try {
          schema = this.systemRequiredValidator(this.registeredSchemas.get(schema.name)!, schema);
        } catch (err) {
          return new Promise((resolve, reject) => {
            reject(err);
          });
        }
        // TODO this is a temporary solution because there was an error on updated config schema for invalid schema fields
      }
      delete this.mongoose.connection.models[schema.name];
    }

    let newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new MongooseSchema(this.mongoose, newSchema);
    return new Promise((resolve, reject) => {
      resolve({ schema: this.models![schema.name] });
    });
  }

  async getSchema(schemaName: string): Promise<{ schema: any }> {
    if (this.models) {
      return { schema: this.models![schemaName].originalSchema };
    }
    throw new Error("Schema not defined yet");
  }

  async getSchemaModel(schemaName: string): Promise<{ model: any }> {
    if (this.models) {
      return { model: this.models![schemaName] };
    }
    throw new Error("Schema not defined yet");
  }

  deleteSchema(schemaName: string) {
    if (!this.models?.[schemaName]) throw ConduitError.notFound("Requested schema not found");
    if (this.models![schemaName].originalSchema.modelOptions.systemRequired) {
      throw ConduitError.forbidden("Can't delete system required schema");
    }
    delete this.models![schemaName];
    delete this.mongoose.connection.models[schemaName];
    // TODO should we delete anything else?
  }

  private systemRequiredValidator(oldSchema: ConduitSchema, newSchema: ConduitSchema): ConduitSchema {
    const clonedOld = cloneDeep(oldSchema.fields);

    // get system required fields
    deepdash.eachDeep(
      clonedOld,
      (value: any, key: any, parent: any, ctx: any) => {
        if (ctx.depth === 0) return true;
        if (
          ((isString(value) || isArray(value)) && !parent.systemRequired) ||
          (!value.systemRequired && (isString(value.type) || isArray(value.type)))
        ) {
          delete parent[key];
          return false;
        } else if (isObject(value) && isEmpty(value)) {
          delete parent[key];
          return false;
        }
      },
      { callbackAfterIterate: true }
    );

    if (!isEmpty(clonedOld)) {
      merge(newSchema.fields, clonedOld);
    }

    // validate types
    this.validateSchemaFields(oldSchema.fields ?? oldSchema.modelSchema, newSchema.fields ?? newSchema.modelSchema);

    return newSchema;
  }

  private validateSchemaFields(oldSchemaFields: any, newSchemaFields: any) {
    const tempObj: { [key: string]: any } = {};

    Object.keys(oldSchemaFields).forEach((key) => {
      if (!oldSchemaFields[key].type && !isString(oldSchemaFields[key]) && !isArray(oldSchemaFields[key])) {
        tempObj[key] = this.validateSchemaFields(oldSchemaFields[key], newSchemaFields[key]);
      } else {
        // There used to be a check here for missing (non system required fields) from the new schema.
        // this got removed so that deletion of fields is supported
        // For a schema to be updated the caller must give the new schema after he gets the old one with getSchema

        const oldType = oldSchemaFields[key].type ? oldSchemaFields[key].type : oldSchemaFields[key];
        const newType = newSchemaFields[key] && newSchemaFields.type ? newSchemaFields[key].type : null;
        if (!newType) return;
        if (isArray(oldType) && isArray(newType)) {
          if (JSON.stringify(oldType[0]) !== JSON.stringify(newType[0]))
            throw ConduitError.forbidden("Invalid schema types");
        } else if (oldType !== newType) {
          // TODO migrate types
          throw ConduitError.forbidden("Invalid schema types");
        }
      }
    });
    return tempObj;
  }
}
