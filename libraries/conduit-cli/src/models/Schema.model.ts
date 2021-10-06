enum TYPE {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
  JSON = 'JSON',
  Relation = 'Relation',
}

type Array = any[];

interface ConduitModelField {
  type?: TYPE | Array | ConduitModel | ConduitModelField;
  enum?: any;
  default?: any;
  model?: string;
  unique?: boolean;
  select?: boolean;
  required?: boolean;
  systemRequired?: boolean;
}

interface ConduitModel {
  [field: string]:
    | ConduitModelField
    | ConduitModelField[]
    | ConduitModel
    | TYPE
    | TYPE[]
    | any[]; // removing this caused multiple issues
}

export interface SchemaModel {
  _id: string;
  enabled: boolean;
  name: string;
  fields: ConduitModel;
}
