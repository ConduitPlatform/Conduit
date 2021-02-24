import { Model, Mongoose, Query, Schema } from 'mongoose';
import { SchemaAdapter } from '../../interfaces';

export class MongooseSchema implements SchemaAdapter {
  model: Model<any>;
  originalSchema: any; // any for now

  constructor(mongoose: Mongoose, schema: any, deepPopulate: any) {
    this.originalSchema = schema;
    let mongooseSchema = new Schema(schema.modelSchema as any, schema.modelOptions);
    mongooseSchema.plugin(deepPopulate, {});
    this.model = mongoose.model(schema.name, mongooseSchema);
  }

  create(query: any): Promise<any> {
    query.createdAt = new Date();
    query.updatedAt = new Date();
    return this.model.create(query).then((r) => r.toObject());
  }

  createMany(query: any): Promise<any> {
    let date = new Date();
    query.forEach((doc: any) => {
      doc.createdAt = date;
      doc.updatedAt = date;
    });

    return this.model.insertMany(query).then((r) => r);
  }

  findByIdAndUpdate(id: any, query: any): Promise<any> {
    // check if it is a document
    if (!query['$set']) {
      query.updatedAt = new Date();
    } else {
      query['$set']['updatedAt'] = new Date();
    }

    return this.model.findByIdAndUpdate(id, query, { new: true }).lean().exec();
  }

  updateMany(filterQuery: any, query: any): Promise<any> {
    return this.model.updateMany(filterQuery, query).exec();
  }

  deleteOne(query: any): Promise<any> {
    return this.model.deleteOne(query).exec();
  }

  deleteMany(query: any): Promise<any> {
    return this.model.deleteMany(query).exec();
  }

  calculatePopulates(queryObj: Query<any>, population: any) {
    population.forEach((r: any, index: number) => {
      let final = r.toString();
      if (r.indexOf('.') !== -1) {
        final = '';
        r = r.split('.');
        let controlBool = true;
        while (controlBool) {
          if (this.originalSchema.modelSchema[r[0]]) {
            controlBool = false;
          } else {
            r.splice(0, 1);
          }
        }
        population[index] = r.join('.');
      }
      // if (final.indexOf('.') !== -1) {
      //   // @ts-ignore
      //   queryObj.deepPopulate(final);
      // } else {
      //   queryObj.populate(final);
      // }
    });
    // @ts-ignore
    queryObj = queryObj.deepPopulate(population);

    return queryObj;
  }

  findMany(
    query: any,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: any
  ): Promise<any> {
    let finalQuery = this.model.find(query);
    if (skip !== null) {
      finalQuery = finalQuery.skip(skip!);
    }
    if (limit !== null) {
      finalQuery = finalQuery.limit(limit!);
    }
    if (populate != null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    if (sort !== null) {
      finalQuery = finalQuery.sort(sort);
    } else {
      finalQuery = finalQuery.sort({ createdAt: -1 });
    }
    return finalQuery.lean().exec();
  }

  findOne(query: any, select?: string, populate?: any): Promise<any> {
    let finalQuery = this.model.findOne(query, select);
    if (populate !== null) {
      finalQuery = this.calculatePopulates(finalQuery, populate);
    }
    return finalQuery.lean().exec();
  }

  countDocuments(query: any) {
    return this.model.find(query).countDocuments().exec();
  }
}
