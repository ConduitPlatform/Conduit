import { isNil } from 'lodash';
import { DataTypes, FindOptions, ModelCtor, Sequelize } from 'sequelize';
import { SchemaAdapter } from '../../interfaces';
import { parseQuery } from './utils';

const deepdash = require('deepdash/standalone');

export class SequelizeSchema implements SchemaAdapter {
  model: ModelCtor<any>;
  originalSchema: any;
  excludedFields: any[];
  relations: any;

  constructor(sequelize: Sequelize, schema: any, originalSchema: any) {
    this.originalSchema = originalSchema;
    this.excludedFields = [];
    this.relations = {};
    const self = this;

    deepdash.eachDeep(
      this.originalSchema.modelSchema,
      (value: any, key: any, parentValue: any, context: any) => {
        if (!parentValue?.hasOwnProperty(key)) {
          return true;
        }

        if (parentValue[key].hasOwnProperty('select')) {
          if (!parentValue[key].select) {
            self.excludedFields.push(key);
          }
        }

        if (
          parentValue[key].hasOwnProperty('type') &&
          parentValue[key].type === 'Relation'
        ) {
          this.relations[key] = parentValue[key].model;
        }
      }
    );

    schema.modelSchema._id = {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    };

    this.model = sequelize.define(schema.name, schema.modelSchema as any, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
  }

  create(query: any): Promise<any> {
    query.createdAt = new Date();
    query.updatedAt = new Date();
    return this.model.create(query, { raw: true });
  }

  createMany(query: any): Promise<any> {
    let date = new Date();
    query.forEach((doc: any) => {
      doc.createdAt = date;
      doc.updatedAt = date;
    });

    return this.model.bulkCreate(query);
  }

  async findOne(
    query: any,
    select?: string,
    populate?: string[],
    relations?: any
  ): Promise<any> {
    let options: FindOptions = { where: parseQuery(query), raw: true };
    options.attributes = { exclude: [...this.excludedFields] };
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }

    let document = await this.model.findOne(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        if (this.relations.hasOwnProperty(relation)) {
          if (relations.hasOwnProperty(this.relations[relation])) {
            document[relation] = await relations[this.relations[relation]].findOne({
              _id: document[relation],
            });
          }
        }
      }
    }

    return document;
  }

  async findMany(
    query: any,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
    relations?: any
  ): Promise<any> {
    let options: FindOptions = { where: parseQuery(query), raw: true };
    options.attributes = { exclude: [...this.excludedFields] };
    if (!isNil(skip)) {
      options.offset = skip;
    }
    if (!isNil(limit)) {
      options.limit = limit;
    }
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    if (!isNil(sort)) {
      options.order = sort;
    }

    const documents = await this.model.findAll(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        let cache: any = {};
        for (const document of documents) {
          if (this.relations.hasOwnProperty(relation)) {
            if (relations.hasOwnProperty(this.relations[relation])) {
              if (!cache.hasOwnProperty(document[relation])) {
                cache[document[relation]] = await relations[
                  this.relations[relation]
                ].findOne({ _id: document[relation] });
              }
              document[relation] = cache[document[relation]];
            }
          }
        }
      }
    }

    return documents;
  }

  deleteOne(query: any): Promise<any> {
    return this.model.destroy({ where: parseQuery(query), limit: 1 });
  }

  deleteMany(query: any): Promise<any> {
    return this.model.destroy({ where: parseQuery(query) });
  }

  async findByIdAndUpdate(
    id: any,
    document: any,
    updateProvidedOnly: boolean = false
  ): Promise<any> {
    if (document.hasOwnProperty('$inc')) {
      await this.model
        .increment(document['$inc'], { where: { _id: id } })
        .catch(console.error);
      delete document['$inc'];
    }

    if (updateProvidedOnly) {
      const record = await this.model.findByPk(id, { raw: true }).catch(console.error);
      if (!isNil(record)) {
        document = { ...record, ...document };
      }
    } else if (document.hasOwnProperty('$set')) {
      document = document['$set'];
      const record = await this.model.findByPk(id, { raw: true }).catch(console.error);
      if (!isNil(record)) {
        document = { ...record, ...document };
      }
    }

    if (document.hasOwnProperty('$push')) {
      for (const key in document['$push']) {
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                document['$push'][key]
              ),
            },
            { where: { _id: id } }
          )
          .catch(console.error);
      }
      delete document['$push'];
    }

    if (document.hasOwnProperty('$pull')) {
      let dbDocument = await this.model.findByPk(id).catch(console.error);
      for (const key in document['$push']) {
        const ind = dbDocument[key].indexOf(document['$push'][key]);
        if (ind > -1) {
          dbDocument[key].splice(ind, 1);
        }
      }
      await this.model.update(document, { where: { _id: id } }).catch(console.error);
      delete document['$pull'];
    }

    document.updatedAt = new Date();
    document = (await this.model.upsert({ _id: id, ...document }))[0];
    return document;
  }

  async updateMany(
    filterQuery: any,
    query: any,
    updateProvidedOnly: boolean = false
  ): Promise<any> {
    let parsed = parseQuery(filterQuery);
    if (query.hasOwnProperty('$inc')) {
      await this.model
        .increment(query['$inc'] as any, { where: parsed })
        .catch(console.error);
      delete query['$inc'];
    }

    if (updateProvidedOnly) {
      const record = await this.model
        .findOne({ where: parsed, raw: true })
        .catch(console.error);
      if (!isNil(record)) {
        document = { ...record, ...document };
      }
    }

    if (query.hasOwnProperty('$push')) {
      for (const key in query['$push']) {
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                query['$push'][key]
              ),
            },
            { where: parsed }
          )
          .catch(console.error);
      }
      delete query['$push'];
    }

    if (query.hasOwnProperty('$pull')) {
      let documents = await this.findMany(filterQuery).catch(console.error);
      for (let document of documents) {
        for (const key in query['$push']) {
          const ind = document[key].indexOf(query['$push'][key]);
          if (ind > -1) {
            document[key].splice(ind, 1);
          }
        }
        await this.model.update(document, { where: parsed }).catch(console.error);
      }
      delete query['$pull'];
    }

    query.updatedAt = new Date();
    return this.model.update(query, { where: parsed });
  }

  countDocuments(query: any): Promise<number> {
    return this.model.count({ where: parseQuery(query) });
  }

  private parseSelect(select: string): string[] | { exclude: string[] } {
    let include = [];
    let exclude = [...this.excludedFields];
    let attributes = select.split(' ');
    let returnInclude = false;

    for (const attribute of attributes) {
      if (attribute[0] === '+') {
        const tmp = attribute.slice(1);
        include.push(tmp);

        const ind = exclude.indexOf(tmp);
        if (ind > -1) {
          exclude.splice(ind, 1);
        }
      } else if (attribute[0] === '-') {
        exclude.push(attribute.slice(1));
      } else {
        include.push(attribute);
        returnInclude = true;
      }
    }

    if (returnInclude) {
      return include;
    }

    return { exclude };
  }
}
