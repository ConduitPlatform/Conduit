import { isNil } from 'lodash';
import { Sequelize, ModelCtor, FindOptions, Op, DataTypes } from 'sequelize';
import { SchemaAdapter } from '../../interfaces';
const deepdash = require('deepdash/standalone');

export class SequelizeSchema implements SchemaAdapter {
    model: ModelCtor<any>;
    originalSchema: any;
    excludedFields: any[];

    constructor(sequelize: Sequelize, schema: any) {
        this.originalSchema = schema;
        this.excludedFields = [];
        const self = this;

        deepdash.eachDeep(this.originalSchema.modelSchema, (value: any, key: any, parentValue: any, context: any) => {
            if (!parentValue?.hasOwnProperty(key)) {
                return true;
            }

            if (parentValue[key].hasOwnProperty('select')) {
                if (!parentValue[key].select) {
                    self.excludedFields.push(key);
                }
            }
        })

        schema.modelSchema._id = {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
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

    findOne(query: any, select?: string): Promise<any> {
        let options: FindOptions = { where: this.parseQuery(query), raw: true };
        options.attributes = {exclude: [...this.excludedFields]};
        if (!isNil(select)) {
            if (select[0] !== '+') {
                try {
                    options.attributes = JSON.parse(select);
                } catch (e) {
                    options.attributes = [select];
                }
            } else {
                const ind = options.attributes.exclude.indexOf(select.slice(1));
                if (ind > -1) {
                    options.attributes.exclude.splice(ind, 1);
                }
            }
        }
        return this.model.findOne(options);
    }

    findMany(query: any, skip?: number, limit?: number, select?: string, sort?: any): Promise<any> {
        let options: FindOptions = { where: this.parseQuery(query), raw: true };
        options.attributes = {exclude: [...this.excludedFields]};
        if (!isNil(skip)) {
            options.offset = skip;
        }
        if (!isNil(limit)) {
            options.limit = limit;
        }
        if (!isNil(select)) {
            if (select[0] !== '+') {
                try {
                    options.attributes = JSON.parse(select);
                } catch (e) {
                    options.attributes = [select];
                }
            } else {
                const ind = options.attributes.exclude.indexOf(select.slice(1));
                if (ind > -1) {
                    options.attributes.exclude.splice(ind, 1);
                }
            }
        }
        if (!isNil(sort)) {
            options.order = sort;
        }
        return this.model.findAll(options);
    }

    deleteOne(query: any): Promise<any> {
        return this.model.destroy({ where: this.parseQuery(query), limit: 1 });
    }

    deleteMany(query: any): Promise<any> {
        return this.model.destroy({ where: this.parseQuery(query) });
    }

    async findByIdAndUpdate(id: any, document: any): Promise<any> {
        if (document.hasOwnProperty('$inc')) {
            await this.model
                .increment(document['$inc'], { where: { _id: id } })
                .catch(console.error);
            delete document['$inc'];
        }

        if (document.hasOwnProperty('$set')) {
            document = document['$set'];
            const record = await this.model
                .findByPk(id, { raw: true })
                .catch(console.error);
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
                        { where: {_id: id} }
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
            await this.model.update(document, { where: { _id: id }}).catch(console.error);
            delete document['$pull'];
        }

        document.updatedAt = new Date();
        return this.model.upsert({ _id: id, ...document });
    }

    async updateMany(filterQuery: any, query: any): Promise<any> {
        let parsed = this.parseQuery(filterQuery);
        if (query.hasOwnProperty('$inc')) {
            await this.model
                .increment(query['$inc'] as any, { where: parsed })
                .catch(console.error);
            delete query['$inc'];
        }

        if (query.hasOwnProperty('$set')) {
            query = query['$set'];
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
        return this.model.count({ where: this.parseQuery(query) });
    }

    private parseQuery(query: any) {
        let parsed: any = {};

        for (const key in query) {
            if (query[key].hasOwnProperty('$ne')) {
                parsed[key] = { [Op.ne]: query[key]['$ne'] };
            } else if (query[key].hasOwnProperty('$gt')) {
                parsed[key] = { [Op.gt]: query[key]['$gt'] };
            } else if (query[key].hasOwnProperty('$gte')) {
                parsed[key] = { [Op.gte]: query[key]['$gte'] };
            } else if (query[key].hasOwnProperty('$lt')) {
                parsed[key] = { [Op.lt]: query[key]['$lt'] };
            } else if (query[key].hasOwnProperty('$lte')) {
                parsed[key] = { [Op.lte]: query[key]['$lte'] };
            } else if (query[key].hasOwnProperty('$in')) {
                parsed[key] = { [Op.in]: query[key]['$in'] };
            } else if (query[key].hasOwnProperty('$nin')) {
                parsed[key] = { [Op.notIn]: query[key]['$nin'] };
            } else if (query[key].hasOwnProperty('$contains')) {
                parsed[key] = { [Op.contains]: query[key]['$contains'] };
            } else {
                parsed[key] = query[key];
            }
        }

        return parsed;
    }
}
