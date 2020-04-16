import {Model, Schema} from "mongoose";
import {ConduitSchema, SchemaAdapter} from "@conduit/sdk";

export class MongooseSchema implements SchemaAdapter {

    model: Model<any>;
    originalSchema: ConduitSchema;

    constructor(mongoose: any, schema: ConduitSchema) {
        this.originalSchema = schema;
        this.model = mongoose.model(schema.name, new Schema(schema.modelSchema as any, schema.modelOptions))
    }

    create(query: any): Promise<any> {
        return this.model.create(query).then(r => r.toObject());
    }

    findByIdAndUpdate(document: any): Promise<any> {
        return this.model.findByIdAndUpdate(document._id, document, {new: true}).lean().exec();
    }

    deleteOne(query: any): Promise<any> {
        return this.model.deleteOne(query).exec();
    }

    deleteMany(query: any): Promise<any> {
        return this.model.deleteMany(query).exec();
    }

    findMany(query: any): Promise<any> {
        return this.model.find(query).lean().exec();
    }

    findOne(query: any, select?: string): Promise<any> {
        return this.model.findOne(query, select).lean().exec();
    }

    findPaginated(query: any, skip: number, limit: number) {
        return this.model.find(query)
            .sort({createdAt: -1})
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();
    }

    countDocuments(query: any) {
        return this.model.find(query)
            .countDocuments()
            .exec();
    }
}
