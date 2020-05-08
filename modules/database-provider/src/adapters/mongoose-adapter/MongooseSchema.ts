import {Model, Schema} from "mongoose";
import {SchemaAdapter} from '../../interfaces';

export class MongooseSchema implements SchemaAdapter {

    model: Model<any>;
    originalSchema: any; // any for now

    constructor(mongoose: any, schema: any) {
        this.originalSchema = schema;
        this.model = mongoose.model(schema.name, new Schema(JSON.parse(schema.modelSchema) as any, JSON.parse(schema.modelOptions)) as Schema)
    }

    create(query: any): Promise<any> {
        query.createdAt = new Date();
        query.updatedAt = new Date();
        return this.model.create(query).then(r => r.toObject());
    }

    findByIdAndUpdate(document: any): Promise<any> {
        document.updatedAt = new Date();
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
