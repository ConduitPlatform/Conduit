export interface CustomEndpoint {
  _id?: any;
  name: string;
  enabled?: boolean;
  operation: number;
  selectedSchema: string;
  selectedSchemaName: string;
  inputs: { name: string; type: string; location: number }[];
  queries?: {
    schemaField: string;
    operation: number;
    comparisonField: { type: string; value: any; like: boolean };
  }[];
  assignments?: {
    schemaField: string;
    action: number;
    assignmentField: { type: string; value: any };
  }[];
  returns: any;
  authentication: boolean;
  paginated: boolean;
  sorted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
