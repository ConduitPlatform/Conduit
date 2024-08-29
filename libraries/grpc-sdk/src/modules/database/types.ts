export type FindOneOptions = {
  select?: string;
  populate?: string | string[];
  userId?: string;
  scope?: string;
};

export type FindManyOptions = {
  select?: string;
  skip?: number;
  limit?: number;
  sort?: { [field: string]: -1 | 1 } | string[] | string;
  populate?: string | string[];
  userId?: string;
  scope?: string;
};
