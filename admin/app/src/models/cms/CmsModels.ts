//TODO schemas, schemaDocuments, customEndpoints, config, schemaFields
//We need further testing

export interface EndpointTypes {
  name: string;
  operation: number;
  selectedSchema: string;
  authentication: boolean;
  paginated: boolean;
  sorted: boolean;
  inputs: [];
  queries: [];
  assignments: [];
}
