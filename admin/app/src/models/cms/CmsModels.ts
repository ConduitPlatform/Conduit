//TODO schemas, schemaDocuments, customEndpoints, config, schemaFields, queries
//We need further testing
import OperationsEnum from '../OperationsEnum';

export interface Schema {
  _id: string;
  enabled?: boolean;
  authentication: boolean;
  crudOperations: boolean;
  name: string;
  fields: SchemaFields[];
  createdAt: string;
  updatedAt: string;
}

export interface EditableSchemaFields {
  name: string;
  authentication: boolean;
  crudOperations: boolean;
  fields: SchemaFields[];
}

export interface ToggleSchma {
  enabled: boolean;
  name: string;
}

export interface EndpointTypes {
  _id: string;
  enabled: boolean;
  name: string;
  operation: typeof OperationsEnum;
  selectedSchema: string;
  selectedSchemaName: string;
  returns: 'string';
  authentication: boolean;
  paginated: boolean;
  sorted: boolean;
  inputs: EndpointInputs[];
  queries: [];
  assignments: [];
  createdAt: 'string';
  updatedAt: 'string';
}

export interface EndpointInputs {
  name: string;
  type: string;
  location: number;
}

export interface CMSData {
  schemas: Schema[];
  schemasFromOtherModules: any;
  documents: {
    documents: CMSDocuments[];
    documentsCount: number;
  };
  customEndpoints: EndpointTypes[];
  count: number;
  config: any;
  selectedSchema: any;
}

export interface SchemaFields {
  type: string;
  unique: boolean;
  select: boolean;
  required: boolean;
  default?: string;
}

export interface CMSDocuments {
  _id: string;
  name: string;
}
