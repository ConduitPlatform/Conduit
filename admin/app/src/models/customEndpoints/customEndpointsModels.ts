export interface Assignment {
  schemaField: string;
  action: number;
  assignmentField: {
    type: 'Input' | 'Custom' | 'Context' | '';
    value: string;
  };
}

export interface Input {
  location: number;
  name: string;
  type: string;
  optional?: boolean;
  array?: boolean;
}
