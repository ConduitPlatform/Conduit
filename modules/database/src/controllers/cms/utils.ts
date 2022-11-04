import {
  ConduitModel,
  ConduitModelField,
  ConduitRouteActions,
  ConduitSchema,
  Indexable,
  RouteBuilder,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { CmsHandlers } from '../../handlers/cms/handler';
import { ConduitBuiltRoute } from '../../interfaces';

export function compareFunction(schemaA: ConduitModel, schemaB: ConduitModel): number {
  const hasA = [];
  const hasB = [];
  const fieldsA = schemaA.fields as ConduitModel;
  const fieldsB = schemaB.fields as ConduitModel;
  for (const k in fieldsA) {
    if ((fieldsA[k] as ConduitModelField).model) {
      hasA.push((fieldsA[k] as ConduitModelField).model);
    }
  }
  for (const k in fieldsB) {
    if ((fieldsB[k] as ConduitModelField).model) {
      hasB.push((fieldsB[k] as ConduitModelField).model);
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
        modelField.type[0] = removeRequiredFields(modelField.type[0]);
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
  const authenticatedRead =
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
    actualSchema.modelOptions.conduit!.cms.crudOperations.create.authenticated;
  const createIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.create.enabled;

  const assignableFields = Object.assign({}, actualSchema.fields);
  delete assignableFields._id;
  delete assignableFields.createdAt;
  delete assignableFields.updatedAt;
  if (createIsEnabled) {
    let route = new RouteBuilder()
      .path(`/${schemaName}`)
      .method(ConduitRouteActions.POST)
      .bodyParams(assignableFields)
      .return(`create${schemaName}`, actualSchema.fields)
      .handler(handlers.createDocument.bind(handlers));

    if (authenticatedCreate) route.middleware('authMiddleware');

    routesArray.push(route.build());

    route = new RouteBuilder()
      .path(`/${schemaName}/many`)
      .method(ConduitRouteActions.POST)
      .bodyParams({ docs: { type: [assignableFields], required: true } })
      .return(`createMany${schemaName}`, {
        docs: [actualSchema.fields],
      })
      .handler(handlers.createManyDocuments.bind(handlers));
    if (authenticatedCreate) route.middleware('authMiddleware');
    routesArray.push(route.build());
  }

  const authenticatedUpdate =
    actualSchema.modelOptions.conduit!.cms.crudOperations.update.authenticated;
  const updateIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.update.enabled;
  if (updateIsEnabled) {
    let route = new RouteBuilder()
      .path(`/${schemaName}/many`)
      .method(ConduitRouteActions.UPDATE)
      .bodyParams({
        docs: {
          type: [{ ...assignableFields, _id: { type: 'String', unique: true } }],
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
      .bodyParams({
        docs: {
          type: [
            {
              ...removeRequiredFields(Object.assign({}, assignableFields)),
              _id: { type: 'String', unique: true },
            },
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
      .urlParams({
        id: { type: TYPE.String, required: true },
      })
      .bodyParams(
        removeRequiredFields(
          Object.assign({}, assignableFields),
        ) as unknown as ConduitModel,
      )
      .return(`patch${schemaName}`, actualSchema.fields)
      .handler(handlers.patchDocument.bind(handlers));
    if (authenticatedUpdate) route.middleware('authMiddleware');

    routesArray.push(route.build());
  }
  const authenticatedDelete =
    actualSchema.modelOptions.conduit!.cms.crudOperations.delete.authenticated;
  const deleteIsEnabled =
    actualSchema.modelOptions.conduit!.cms.crudOperations.delete.enabled;
  if (deleteIsEnabled) {
    const route = new RouteBuilder()
      .path(`/${schemaName}/:id`)
      .method(ConduitRouteActions.DELETE)
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
