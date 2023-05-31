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
import { CmsHandlers } from '../../handlers/cms/crud.handler';
import { ConduitBuiltRoute } from '../../interfaces';
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

  const assignableFields: ConduitModel = Object.assign({}, actualSchema.fields);
  delete assignableFields._id;
  delete assignableFields.createdAt;
  delete assignableFields.updatedAt;
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
              ...removeRequiredFields(Object.assign({}, assignableFields)),
              _id: { type: 'String', unique: true },
            } as unknown as ArrayConduitModel,
          ],
          required: true,
        },
      })
      .return(`patchMany${schemaName}`, {
        docs: [actualSchema.fields],
      })
      .handler(handlers.updateManyDocuments.bind(handlers));
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
          Object.assign({}, assignableFields),
        ) as unknown as ConduitModel,
      )
      .return(`patch${schemaName}`, actualSchema.fields)
      .handler(handlers.updateDocument.bind(handlers));
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
