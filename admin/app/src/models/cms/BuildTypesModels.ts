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
