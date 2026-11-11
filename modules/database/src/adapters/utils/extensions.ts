import { ConduitModel } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import {
  ConduitDatabaseSchema,
  DeclaredSchemaExtension,
} from '../../interfaces/index.js';

import * as deepdash from 'deepdash-es/standalone';

function deepFieldValidate(extFields: ConduitModel) {
  deepdash.eachDeep(extFields, (value: any, key: string) => {
    if (key === 'unique' && value === true) {
      throw new ModuleError({
        ...errors.EXTENSION_FIELD_CONSTRAINT_INVALID,
        message: "Schema extension fields can not be 'unique'",
      });
    }
    if (key === 'required' && value === true) {
      throw new ModuleError({
        ...errors.EXTENSION_FIELD_CONSTRAINT_INVALID,
        message: "Schema extension fields can not be 'required'",
      });
    }
  });
}

export function validateExtensionFields(
  schema: ConduitDatabaseSchema,
  extFields: ConduitModel,
  extOwner: string,
) {
  for (const field of Object.keys(extFields)) {
    if (field in schema.fields) throw new ModuleError(errors.EXTENSION_FIELD_DUPLICATE);
  }
  for (const ext of schema.extensions) {
    if (ext.ownerModule === extOwner) continue;
    for (const field of Object.keys(extFields)) {
      if (field in ext.fields) throw new ModuleError(errors.EXTENSION_FIELD_DUPLICATE);
    }
  }
  deepFieldValidate(extFields);
}

export function stitchSchema(schema: ConduitDatabaseSchema) {
  // TODO: This gets called from _createSchemaFromAdapter, schema type is missing stuff from ConduitDatabaseSchema

  // Extension array initialization will be redundant once we streamline
  // ConduitSchema -> ConduitDatabaseSchema transformations
  if (!schema.extensions) schema.extensions = [];
  schema.compiledFields = JSON.parse(JSON.stringify(schema.fields));
  schema.extensions.forEach((ext: DeclaredSchemaExtension) => {
    Object.keys(ext.fields).forEach(field => {
      schema.compiledFields[field] = ext.fields[field];
    });
  });
}
