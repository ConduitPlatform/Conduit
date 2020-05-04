import {ConnectionOptions, Mongoose} from "mongoose"
import {MongooseSchema} from "./MongooseSchema";
import {schemaConverter} from "./SchemaConverter";
import {ConduitError, ConduitSchema, DatabaseAdapter, SchemaAdapter} from "@conduit/sdk";
const deepdash = require('deepdash/standalone')
import { isEmpty, isNil, cloneDeep, isString, isObject } from 'lodash';

export class MongooseAdapter implements DatabaseAdapter {

    mongoose: Mongoose;
    connectionString: string;
    options: ConnectionOptions = {
        autoReconnect: true,
        keepAlive: true,
        connectTimeoutMS: 30000,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false
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

    connect() {
        this.mongoose
            .connect(this.connectionString, this.options)
            .then(() => {
                console.log('MongoDB dashboard is connected');
                let db = this.mongoose.connection;

                db.on('error', (err: any) => {
                    console.error('Dashboard Connection error:', err.message);
                });

                db.once('open', function callback() {
                    console.info("Connected to Dashboard Database!");
                });

                db.on('reconnected', function () {
                    console.log('Dashboard Database reconnected!');
                });

                db.on('disconnected', function () {
                    console.log('Dashboard Database Disconnected');

                });
            })
            .catch((err: any) => {
                console.log(err);
                throw new Error("Connection with Mongo not possible")
            });
    }

    createSchemaFromAdapter(schema: ConduitSchema): SchemaAdapter {
        const Schema = this.mongoose.Schema;
        if (!this.models) {
            this.models = {};
        }
        let newSchema = schemaConverter(schema);

        if (this.registeredSchemas.has(schema.name)) {
            schema = this.systemRequiredValidator(this.registeredSchemas.get(schema.name)!, newSchema);
            delete this.mongoose.connection.models[schema.name];
        }

        this.registeredSchemas.set(schema.name, schema);
        this.models[schema.name] = new MongooseSchema(this.mongoose, newSchema);
        return this.models[schema.name];
    }

    getSchema(schemaName: string): SchemaAdapter {
        if (this.models) {
            return this.models[schemaName]
        }
        throw new ConduitError("SchemaLookupError", 500, "Schema not defined yet!");
    }

    deleteSchema(schemaName: string) {
        if (!this.models?.[schemaName]) throw ConduitError.notFound('Requested schema not found');
        if (this.models![schemaName].originalSchema.modelOptions.systemRequired) {
            throw ConduitError.forbidden("Can't delete system required schema");
        }
        delete this.models![schemaName];
        delete this.mongoose.connection.models[schemaName];
        // TODO should we delete anything else?
    }

    private systemRequiredValidator(oldSchema: ConduitSchema, newSchema: ConduitSchema): ConduitSchema {
        console.log(newSchema.fields)

        const clonedOld = cloneDeep(oldSchema.fields);
        deepdash.eachDeep(clonedOld, (value: any, key: any, parent: any) => {

            if (isString(value) ||  (!value.systemRequired && isString(value.type))) {
                delete parent[key];
                return false;
            } else if (isObject(value) && isEmpty(value)){//(value as any).systemRequired) {
                delete parent[key];
                return false;
            }


        });

        console.log(clonedOld)
        return newSchema;

    }

    private filterRequired(fields: any) {
        Object.keys(fields).forEach(key => {
            const value = fields[key];

            if (isString(value) ||  (!value.systemRequired && isString(value.type))) {
                delete fields[key];
            } else {
                this.filterRequired(fields[key]);
                if (Object.keys(fields[key]).length === 0) {
                    console.log(fields[key])
                    delete fields[key];
                }
            }
        });
    }
    //
    // private getSystemRequiredFields(oldSchemaFields: any, newSchemaFields: any) {
    //
    //     const tempObj: { [key: string]: any } = {};
    //
    //     Object.keys(oldSchemaFields).forEach(key => {
    //        if (!oldSchemaFields[key].type && typeof !oldSchemaFields[key] === 'string') {
    //            tempObj[key] = this.getSystemRequiredFields(oldSchemaFields[key], newSchemaFields[key]) ;
    //
    //        } else {
    //            if (oldSchemaFields[key].systemRequired) {
    //                tempObj[key] = oldSchemaFields[key];
    //                return;
    //            } else if (!newSchemaFields.hasOwnProperty(key) || !tempObj.hasOwnProperty(key)) throw ConduitError.forbidden('Fields are missing on schema');
    //
    //            if (!isNil(newSchemaFields[key]) &&
    //              !oldSchemaFields[key].systemRequired &&
    //              (oldSchemaFields[key].type !== newSchemaFields[key].type || oldSchemaFields[key] !== newSchemaFields[key])) {
    //                console.log(oldSchemaFields[key], newSchemaFields[key])
    //                console.log(oldSchemaFields[key] === newSchemaFields[key])
    //                // TODO Migrate types on other models. Error throwing is temporary
    //                throw ConduitError.forbidden('Invalid types on schema');
    //            }
    //        }
    //
    //     });
    //     console.log(tempObj)
    //     return tempObj;
    // }


}
