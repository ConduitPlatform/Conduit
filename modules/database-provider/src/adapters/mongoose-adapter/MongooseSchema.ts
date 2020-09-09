import {Model, Schema} from "mongoose";
import {SchemaAdapter} from '../../interfaces';

export class MongooseSchema implements SchemaAdapter {

    model: Model<any>;
    originalSchema: any; // any for now

    constructor(mongoose: any, schema: any) {
        this.originalSchema = schema;
        this.model = mongoose.model(schema.name, new Schema(schema.modelSchema as any, schema.modelOptions))
    }

    create(query: any): Promise<any> {
        query.createdAt = new Date();
        query.updatedAt = new Date();
        return this.model.create(query).then(r => r.toObject());
    }

    findByIdAndUpdate(id: any, query: any): Promise<any> {
        // check if it is a document
        if (!query['$set']) {
            query.updatedAt = new Date();
        } else {
            query['$set']['updatedAt'] = new Date();
        }

        return this.model.findByIdAndUpdate(id, query, {new: true}).lean().exec();
    }

    deleteOne(query: any): Promise<any> {
        return this.model.deleteOne(query).exec();
    }

    deleteMany(query: any): Promise<any> {
        return this.model.deleteMany(query).exec();
    }

    findMany(query: any, skip?: number, limit?: number, select?: string, sort?: any): Promise<any> {
        let finalQuery = this.model.find(query);
        if (skip !== null) {
            finalQuery = finalQuery.skip(skip!);
        }
        if (limit !== null) {
            finalQuery = finalQuery.limit(limit!);
        }
        if (sort !== null) {
            finalQuery = finalQuery.sort(sort);
        } else {
            finalQuery = finalQuery.sort({createdAt: -1});
        }
        return finalQuery.lean().exec();
    }

    findOne(query: any, select?: string): Promise<any> {
        return this.model.findOne(query, select).lean().exec();
    }

    countDocuments(query: any) {
        return this.model.find(query)
            .countDocuments()
            .exec();
    }
}
