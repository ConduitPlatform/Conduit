type documentKeys<T> = keyof T;
type documentValues<T> = T[keyof T];
type operators =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$regex'
  | '$options'
  | '$like'
  | '$ilike'
  | '$exists';
type arrayOperators = '$in' | '$nin';
type conditionOperators = '$or' | '$and';

type simpleQuery<T> = {
  [key in documentKeys<T>]?: documentValues<T> | mixedQuery<T>;
};

type mixedQuery<T> =
  | { $exists: boolean }
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

type numericDocumentKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends number ? K : never;
}[keyof T];

type incQuery<T> = {
  $inc: { [K in numericDocumentKeys<T>]?: number };
};

export type Query<T> =
  | simpleQuery<T>
  | pushQuery<T>
  | setQuery<T>
  | incQuery<T>
  // | arrayQuery<T>
  | conditionalQuery<T>;
