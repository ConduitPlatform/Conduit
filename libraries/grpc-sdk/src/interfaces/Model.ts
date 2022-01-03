export enum TYPE {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
  JSON = 'JSON',
  Relation = 'Relation',
}

export type Array = any[];

export interface ConduitModelField {
  type?: TYPE | Array | ConduitModel | ConduitModelField;
  enum?: any;
  default?: any;
  model?: string;
  unique?: boolean;
  select?: boolean;
  required?: boolean;
  systemRequired?: boolean;
}

export interface ConduitModel {
  [field: string]:
    | ConduitModelField
    | ConduitModelField[]
    | ConduitModel
    | TYPE
    | TYPE[]
    | any[]; // removing this caused multiple issues
}

export const ConduitModelOptionsPermModifyType = ['Everything', 'Nothing', 'ExtensionOnly'] as const;

export interface ConduitModelOptions {
  timestamps?: boolean;
  _id?: boolean;
  permissions?: {
    extendable: boolean,
    canCreate: boolean,
    canModify: typeof ConduitModelOptionsPermModifyType[number],
    canDelete: boolean,
  },
  conduit?: {
    [field: string]: any,
  };
}
