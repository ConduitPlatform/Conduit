import { Indexable } from './Indexable';

export type UrlParams = {
  [key: string]: string;
};

export type QueryParams = {
  [key: string]: string | string[];
};

export type BodyParams = Indexable;
