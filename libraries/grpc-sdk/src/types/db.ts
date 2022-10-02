type documentKeys<T> = keyof T;
type documentValues<T> = T[keyof T];
type operators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte';
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

let query: Query<{ name: string; age: number }> = {
  name: 'John',
  age: {
    $gt: 18,
    $in: [18, 19, 20],
  },
  $or: [{ name: 'kostas' }, { name: 'Giwrgos' }],
};
