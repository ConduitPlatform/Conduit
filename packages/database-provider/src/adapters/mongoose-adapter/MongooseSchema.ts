import {Model} from "mongoose";
import {SchemaAdapter} from "@conduit/sdk";

export class MongooseSchema implements SchemaAdapter {

    model: Model<any>;

    constructor(mongooseModel: any) {
        this.model = mongooseModel;
    }

    create(query: any): Promise<any> {
        return this.model.create(query);
    }

    findByIdAndUpdate(document: any): Promise<any> {
        return this.model.findByIdAndUpdate(document._id, document).exec();
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
        return this.model.findOne(query, select).exec();
    }

    findPaginated(query: any, skip: number, limit: number) {
        return this.model.find(query)
          .sort({createdAt: -1})
          .skip(skip)
          .limit(limit)
          .exec();
    }

    countDocuments(query: any) {
        return this.model.find(query)
          .countDocuments()
          .exec();
    }
}
