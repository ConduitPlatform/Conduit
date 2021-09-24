export type IDrawerTypes =
  | 'Text'
  | 'Number'
  | 'Date'
  | 'Boolean'
  | 'Enum'
  | 'ObjectId'
  | 'Group'
  | 'Relation';

export interface IDrawerData {
  destination: {
    droppableId: string;
    index: number;
  };
  open: boolean;
  type: IDrawerTypes;
}

export type ISimpleDataTypes = 'Text' | 'Number' | 'Date';

export interface ISimpleData {
  default: string;
  isArray: boolean;
  name: string;
  required: boolean;
  select: boolean;
  type: ISimpleDataTypes;
  unique: boolean;
  isEnum?: boolean;
}

export interface IEnumData {
  enumValues: string;
  isEnum: boolean;
  name: string;
  required: boolean;
  select: boolean;
  type: 'Text' | 'Number';
}

export interface IBooleanData {
  default: boolean;
  id: string;
  isArray: boolean;
  name: string;
  placeholderFalse: string;
  placeholderTrue: string;
  required: boolean;
  select: boolean;
  type: 'Boolean';
  unique: boolean;
}

export interface IObjectData {
  name: string;
  required: boolean;
  select: boolean;
  type: 'ObjectId';
  unique: boolean;
}

export interface IRelationData {
  isArray: boolean;
  model: string;
  name: string;
  required: boolean;
  select: boolean;
  type: 'Relation';
}

export type IGroupContentData = IGroupChildContentData | IGroupChildData | [];

export interface IGroupData {
  content: IGroupContentData;
  isArray: boolean;
  name: string;
  required: boolean;
  select: boolean;
  type: 'Group';
  unique: boolean;
}

export type IGroupChildContentData =
  | ISimpleData
  | IBooleanData
  | IEnumData
  | IRelationData
  | IObjectData;

export interface IGroupChildData {
  content: IGroupChildContentData;
  isArray: boolean;
  name: string;
  required: boolean;
  select: boolean;
  type: 'Group';
  unique: boolean;
}
