import {
  ArrayConduitModel,
  ConduitModel,
  ConduitModelField,
  ConduitModelFieldRelation,
  ConduitRouteActions,
  ConduitSchema,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { CmsHandlers } from '../../handlers/cms/crud.handler.js';
import { ConduitBuiltRoute } from '../../interfaces/index.js';
import { RouteBuilder } from '@conduitplatform/module-tools';

export function compareFunction(schemaA: ConduitModel, schemaB: ConduitModel): number {
  const hasA = [];
  const hasB = [];
  const fieldsA = schemaA.fields as ConduitModel;
  const fieldsB = schemaB.fields as ConduitModel;
  for (const k in fieldsA) {
    if ((fieldsA[k] as ConduitModelFieldRelation).model) {
      hasA.push((fieldsA[k] as ConduitModelFieldRelation).model);
    }
  }
  for (const k in fieldsB) {
    if ((fieldsB[k] as ConduitModelFieldRelation).model) {
      hasB.push((fieldsB[k] as ConduitModelFieldRelation).model);
    }
  }
  const schemaAName = (schemaA as unknown as ConduitSchema).name;
  const schemaBName = (schemaB as unknown as ConduitSchema).name;

  if (hasA.length === 0 && hasB.length === 0) {
    return 0;
  } else if (hasA.length === 0 && hasB.length !== 0) {
    if (hasB.indexOf(schemaAName)) {
      return -1;
    } else {
      return 1;
    }
  } else if (hasA.length !== 0 && hasB.length === 0) {
    if (hasA.indexOf(schemaBName)) {
      return -1;
    } else {
      return 1;
    }
  } else {
    if (hasA.indexOf(schemaBName) && hasB.indexOf(schemaAName)) {
      return 1;
    } else if (hasA.indexOf(schemaBName)) {
      return -1;
    } else if (hasB.indexOf(schemaAName)) {
      return 1;
    } else {
      return 1;
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVectorField(field: unknown): boolean {
  if (field === TYPE.Vector || field === 'Vector') return true;
  if (Array.isArray(field) && field.length > 0) return isVectorField(field[0]);
  if (!isPlainObject(field)) return false;
  return isVectorField(field.type);
}

function isHiddenSelectField(field: unknown): boolean {
  return isPlainObject(field) && field.select === false;
}

function isManagedHashField(name: string): boolean {
  return name.endsWith('SourceHash');
}

export function isCmsWriteOmittedField(name: string, field: unknown): boolean {
  if (name === '_id' || name === 'createdAt' || name === 'updatedAt') return true;
  if (isManagedHashField(name)) return true;
  if (isHiddenSelectField(field)) return true;
  return isVectorField(field);
}

export function getAssignableCmsFields(sourceFields: ConduitModel): ConduitModel {
  return stripAssignableModel(sourceFields);
}

const FIELD_DESCRIPTOR_KEYS = new Set([
  'type',
  'sqlType',
  'default',
  'description',
  'required',
  'select',
  'unique',
  'index',
  'enum',
  'model',
  'validate',
  'dimensions',
  'similarity',
  'provider',
]);

function isNestedConduitModel(field: unknown): field is ConduitModel {
  if (!isPlainObject(field)) return false;
  if (isVectorField(field) || isHiddenSelectField(field)) return false;
  if ('type' in field || 'enum' in field || 'model' in field) return false;
  return Object.keys(field).some(key => !FIELD_DESCRIPTOR_KEYS.has(key));
}

function stripAssignableModel(source: ConduitModel): ConduitModel {
  const assignable: ConduitModel = {};
  for (const [name, field] of Object.entries(source)) {
    if (isCmsWriteOmittedField(name, field)) continue;
    assignable[name] = cloneAssignableValue(field);
  }
  return assignable;
}

function cloneAssignableArrayItem(item: unknown): unknown {
  if (Array.isArray(item)) {
    return item.map(cloneAssignableArrayItem);
  }
  if (!isPlainObject(item)) return item;
  if (isCmsWriteOmittedField('item', item) && isVectorField(item)) {
    return { ...item };
  }
  if (isNestedConduitModel(item)) {
    return stripAssignableModel(item);
  }
  return cloneAssignableValue(item);
}

function cloneAssignableValue(field: unknown): ConduitModel[string] {
  if (Array.isArray(field)) {
    return field.map(cloneAssignableArrayItem) as ConduitModel[string];
  }
  if (!isPlainObject(field)) {
    return field as ConduitModel[string];
  }
  if (isNestedConduitModel(field)) {
    return stripAssignableModel(field) as ConduitModel[string];
  }
  const cloned: Record<string, unknown> = { ...field };
  if (Array.isArray(cloned.type)) {
    cloned.type = cloned.type.map(cloneAssignableArrayItem);
  } else if (isPlainObject(cloned.type) && !isVectorField(cloned)) {
    if (isNestedConduitModel(cloned.type) || isPlainObject(cloned.type)) {
      cloned.type = stripAssignableModel(cloned.type as ConduitModel);
    }
  }
  return cloned as ConduitModel[string];
}

function cloneConduitModel(fields: ConduitModel): ConduitModel {
  const cloned: ConduitModel = {};
  for (const [name, field] of Object.entries(fields)) {
    cloned[name] = cloneAssignableValue(field);
  }
  return cloned;
}

function removeRequiredFields(fields: ConduitModel) {
  for (const field in fields) {
    const modelField = fields[field] as ConduitModelField;
    if (modelField.required === true) {
      modelField.required = false;
    }
    if (Array.isArray(modelField.type)) {
      if (typeof modelField.type[0] === 'object') {
        (<ConduitModel>modelField.type[0]) = removeRequiredFields(modelField.type[0]);
      }
    } else if (typeof modelField.type === 'object') {
      modelField.type = removeRequiredFields(modelField.type as ConduitModel);
    }
  }
  return fields;
}

export function getOps(
  schemaName: string,
  actualSchema: ConduitSchema,
  handlers: CmsHandlers,
) {
  const routesArray: ConduitBuiltRoute[] = [];
  const authorizationEnabled =
    actualSchema.modelOptions.conduit!.authorization?.enabled || false;
  const authenticatedRead =
    authorizationEnabled ||
    actualSchema.modelOptions.conduit!.cms.crudOperations.read.authenticated;
  const readIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.read.enabled;
  if (readIsEnabled) {
    let route = new RouteBuilder()
      .path(`/${schemaName}`)
      .method(ConduitRouteActions.GET)
      .queryParams({
        skip: TYPE.Number,
        limit: TYPE.Number,
        sort: [TYPE.String],
        populate: [TYPE.String],
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .cacheControl(authenticatedRead ? 'private, max-age=10' : 'public, max-age=10')
      .return(`get${schemaName}`, {
        documents: [actualSchema.fields],
        count: TYPE.Number,
      })
      .handler(handlers.getDocuments.bind(handlers));
    if (authenticatedRead) route.middleware('authMiddleware');
    routesArray.push(route.build());
    route = new RouteBuilder()
      .path(`/${schemaName}/:id`)
      .method(ConduitRouteActions.GET)
      .queryParams({
        populate: [TYPE.String],
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .urlParams({
        id: { type: TYPE.String, required: true },
      })
      .cacheControl(authenticatedRead ? 'private, max-age=10' : 'public, max-age=10')
      .return(`${schemaName}`, actualSchema.fields)
      .handler(handlers.getDocumentById.bind(handlers));
    if (authenticatedRead) route.middleware('authMiddleware');
    routesArray.push(route.build());
  }
  const authenticatedCreate =
    authorizationEnabled ||
    actualSchema.modelOptions.conduit!.cms.crudOperations.create.authenticated;
  const createIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.create.enabled;

  const sourceFields =
    (actualSchema as unknown as { compiledFields?: ConduitModel }).compiledFields ??
    actualSchema.fields;
  const assignableFields: ConduitModel = getAssignableCmsFields(sourceFields);
  if (createIsEnabled) {
    let route = new RouteBuilder()
      .path(`/${schemaName}`)
      .method(ConduitRouteActions.POST)
      .bodyParams(assignableFields)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .return(`create${schemaName}`, actualSchema.fields)
      .handler(handlers.createDocument.bind(handlers));

    if (authenticatedCreate) route.middleware('authMiddleware');

    routesArray.push(route.build());

    route = new RouteBuilder()
      .path(`/${schemaName}/many`)
      .method(ConduitRouteActions.POST)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .bodyParams({
        docs: { type: [assignableFields as ArrayConduitModel], required: true },
      })
      .return(`createMany${schemaName}`, {
        docs: [actualSchema.fields],
      })
      .handler(handlers.createManyDocuments.bind(handlers));
    if (authenticatedCreate) route.middleware('authMiddleware');
    routesArray.push(route.build());
  }

  const authenticatedUpdate =
    authorizationEnabled ||
    actualSchema.modelOptions.conduit!.cms.crudOperations.update.authenticated;
  const updateIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.update.enabled;
  if (updateIsEnabled) {
    let route = new RouteBuilder()
      .path(`/${schemaName}/many`)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .method(ConduitRouteActions.UPDATE)
      .bodyParams({
        docs: {
          type: [
            { ...assignableFields, _id: TYPE.String } as unknown as ArrayConduitModel,
          ],
          required: true,
        },
      })
      .return(`updateMany${schemaName}`, {
        docs: [actualSchema.fields],
      })
      .handler(handlers.updateManyDocuments.bind(handlers));

    if (authenticatedUpdate) route.middleware('authMiddleware');
    routesArray.push(route.build());
    route = new RouteBuilder()
      .path(`/${schemaName}/many`)
      .method(ConduitRouteActions.PATCH)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .bodyParams({
        docs: {
          type: [
            {
              ...removeRequiredFields(cloneConduitModel(assignableFields)),
              _id: { type: 'String', unique: true },
            } as unknown as ArrayConduitModel,
          ],
          required: true,
        },
      })
      .return(`patchMany${schemaName}`, {
        docs: [actualSchema.fields],
      })
      .handler(handlers.patchManyDocuments.bind(handlers));
    if (authenticatedUpdate) route.middleware('authMiddleware');

    routesArray.push(route.build());

    route = new RouteBuilder()
      .path(`/${schemaName}/:id`)
      .method(ConduitRouteActions.UPDATE)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .urlParams({
        id: { type: TYPE.String, required: true },
      })
      .bodyParams(assignableFields)
      .return(`update${schemaName}`, actualSchema.fields)
      .handler(handlers.updateDocument.bind(handlers));
    if (authenticatedUpdate) route.middleware('authMiddleware');

    routesArray.push(route.build());

    route = new RouteBuilder()
      .path(`/${schemaName}/:id`)
      .method(ConduitRouteActions.PATCH)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .urlParams({
        id: { type: TYPE.String, required: true },
      })
      .bodyParams(
        removeRequiredFields(
          cloneConduitModel(assignableFields),
        ) as unknown as ConduitModel,
      )
      .return(`patch${schemaName}`, actualSchema.fields)
      .handler(handlers.patchDocument.bind(handlers));
    if (authenticatedUpdate) route.middleware('authMiddleware');

    routesArray.push(route.build());
  }
  const authenticatedDelete =
    authorizationEnabled ||
    actualSchema.modelOptions.conduit!.cms.crudOperations.delete.authenticated;
  const deleteIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.delete.enabled;
  if (deleteIsEnabled) {
    const route = new RouteBuilder()
      .path(`/${schemaName}/:id`)
      .method(ConduitRouteActions.DELETE)
      .queryParams({
        // scope is used when authorization is enabled, to determine how an authenticated user can access the data
        ...(authorizationEnabled ? { scope: TYPE.String } : {}),
      })
      .urlParams({
        id: { type: TYPE.String, required: true },
      })
      .return(`delete${schemaName}`, TYPE.String)
      .handler(handlers.deleteDocument.bind(handlers));
    if (authenticatedDelete) route.middleware('authMiddleware');
    routesArray.push(route.build());
  }

  return routesArray;
}

export function sortAndConstructRoutes(schemas: Indexable, handlers: CmsHandlers) {
  let routesArray: ConduitBuiltRoute[] = [];
  const schemaSort = [];
  for (const k in schemas) {
    schemaSort.push(k);
  }
  schemaSort.sort((a: string, b: string) => {
    return compareFunction(schemas[a], schemas[b]);
  });
  schemaSort.forEach(r => {
    routesArray = routesArray.concat(getOps(r, schemas[r], handlers));
  });
  return routesArray;
}
