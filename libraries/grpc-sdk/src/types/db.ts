type documentKeys<T> = keyof T;
type documentValues<T> = T[keyof T];
type operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$regex' | '$options';
type arrayOperators = '$in' | '$nin';
type conditionOperators = '$or' | '$and';

type simpleQuery<T> = {
  [key in documentKeys<T>]?: documentValues<T> | mixedQuery<T>;
};

type mixedQuery<T> =
  | { [key in operators]?: documentValues<T> }
  | { [key in arrayOperators]?: documentValues<T>[] };

type conditionalQuery<T> = {
  [key in conditionOperators]?: Query<T>[];
};

//todo make better
type pushQuery<T> = {
  $push: simpleQuery<T>;
};

type setQuery<T> = {
  $set: simpleQuery<T>;
};

export type Query<T> =
  | simpleQuery<T>
  | pushQuery<T>
  | setQuery<T>
  // | arrayQuery<T>
  | conditionalQuery<T>;

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
