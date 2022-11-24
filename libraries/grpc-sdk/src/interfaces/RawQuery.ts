export interface RawQuery {
  mongoQuery?: RawMongoQuery;
  sqlQuery?: RawSQLQuery;
}

export type RawMongoQuery = {
  aggregate?: object[];
  count?: object;
  deleteOne?: object;
  deleteMany?: object | object[];
  drop?: object;
  explain?: object;
  find?: object;
  insertOne?: object;
  insertMany?: object | object[];
  updateOne?: object;
  updateMany?: object | object[];
  options?: object;
};

export type RawSQLQuery = {
  query: string;
  options?: object;
};
