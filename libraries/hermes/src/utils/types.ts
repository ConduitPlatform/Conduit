import {
  ConduitGrpcSdk,
  ConduitModel,
  ConduitModelFieldRelation,
} from '@conduitplatform/grpc-sdk';
import { TypeRegistry } from '../classes/index.js';
import { SwaggerParser } from '../Rest/SwaggerParser.js';
import { GraphQlParser } from '../GraphQl/GraphQlParser.js';

type TypeObject = {
  known: Set<string>;
  unknown: Set<string>;
  imported: Map<string, ConduitModel>;
  missing: Set<string>;
};

export function importDbTypes(
  parser: SwaggerParser | GraphQlParser,
  importedTypeHandler: (
    typeName: string,
    typeFields: ConduitModel,
    gqlRefresh?: boolean,
  ) => void,
) {
  const typesObject: TypeObject = {
    known: parser.knownTypes,
    unknown: new Set(
      Array.from(parser.requestedTypes).filter(t => {
        return !parser.knownTypes.has(t);
      }),
    ),
    imported: new Map<string, ConduitModel>(),
    missing: new Set<string>(),
  };
  if (typesObject.unknown.size > 0) {
    for (const typeName of typesObject.unknown) {
      const typeFields = TypeRegistry.getInstance().getType(typeName);
      if (typeFields) {
        typesObject.imported.set(typeName, typeFields);
        findRelations(typesObject, typeFields);
      } else {
        typesObject.missing.add(typeName);
      }
    }
    if (typesObject.missing.size > 0) {
      const missingTypes = Array.from(typesObject.missing);
      ConduitGrpcSdk.Logger.error(`Could not retrieve types: ${missingTypes}`);
      throw new Error(`Could not retrieve types: ${missingTypes}`);
    }
    typesObject.imported.forEach((typeFields, typeName) => {
      importedTypeHandler(typeName, typeFields, false);
      parser.knownTypes.delete(typeName);
    });
  }
}

function findRelations(typesObject: TypeObject, typeFields: ConduitModel) {
  Object.keys(typeFields).forEach(field => {
    if (Array.isArray(typeFields[field])) {
      (typeFields[field] as ConduitModel[]).forEach(arrField => {
        findRelations(typesObject, { arrField });
      });
    } else if (
      typeof typeFields[field] === 'object' &&
      (typeFields[field] as ConduitModelFieldRelation).type === 'Relation'
    ) {
      const typeName = (typeFields[field] as ConduitModelFieldRelation).model!;
      const typeIsKnown =
        typesObject.known.has(typeName) || typesObject.imported.has(typeName);
      if (!typeIsKnown) {
        typesObject.unknown.add(typeName);
        const typeFields = TypeRegistry.getInstance().getType(typeName);
        if (typeFields) {
          typesObject.imported.set(typeName, typeFields);
          findRelations(typesObject, typeFields);
        } else {
          typesObject.missing.add(typeName);
        }
      }
    }
  });
}
