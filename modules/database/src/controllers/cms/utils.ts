import {
  ConduitRouteActions,
  RouteBuilder,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { CmsHandlers } from '../../handlers/cms.handler';

export function compareFunction(schemaA: any, schemaB: any): number {
  let hasA = [];
  let hasB = [];
  for (const k in schemaA.fields) {
    if (schemaA.fields[k].model) {
      hasA.push(schemaA.fields[k].model);
    }
  }
  for (const k in schemaB.fields) {
    if (schemaB.fields[k].model) {
      hasB.push(schemaB.fields[k].model);
    }
  }

  if (hasA.length === 0 && hasB.length === 0) {
    return 0;
  } else if (hasA.length === 0 && hasB.length !== 0) {
    if (hasB.indexOf(schemaA.name)) {
      return -1;
    } else {
      return 1;
    }
  } else if (hasA.length !== 0 && hasB.length === 0) {
    if (hasA.indexOf(schemaB.name)) {
      return -1;
    } else {
      return 1;
    }
  } else {
    if (hasA.indexOf(schemaB.name) && hasB.indexOf(schemaA.name)) {
      return 1;
    } else if (hasA.indexOf(schemaB.name)) {
      return -1;
    } else if (hasB.indexOf(schemaA.name)) {
      return 1;
    } else {
      return 1;
    }
  }
}

function removeRequiredFields(fields: any) {
  for (let field in fields) {
    if (fields[field].required === true) {
      fields[field].required = false;
    }
    if (Array.isArray(fields[field].type)) {
      if (typeof fields[field].type[0] === 'object') {
        fields[field].type[0] = removeRequiredFields(fields[field].type[0]);
      }
    } else if (typeof fields[field].type === 'object') {
      fields[field].type = removeRequiredFields(fields[field].type);
    }
  }
  return fields;
}

export function getOps(schemaName: string, actualSchema: any, handlers: CmsHandlers) {
  let routesArray: any = [];
  const authenticatedRead = actualSchema.modelOptions.conduit.cms.crudOperations.read.authenticated;
  const readIsEnabled = actualSchema.modelOptions.conduit.cms.crudOperations.read.enabled;
  let route = new RouteBuilder()
    .path(`/${schemaName}/:id`)
    .method(ConduitRouteActions.GET)
    .urlParams({
      id: { type: TYPE.String, required: true },
    }).cacheControl(authenticatedRead
      ? 'private, max-age=10'
      : 'public, max-age=10')
    .return(`${schemaName}`, actualSchema.fields)
    .handler(handlers.getDocumentById.bind(handlers));
  if (authenticatedRead)
    route.middleware('authMiddleware');
  if (readIsEnabled)
    routesArray.push(route.build());

  route = new RouteBuilder()
    .path(`/${schemaName}`)
    .method(ConduitRouteActions.GET)
    .queryParams({
      skip: TYPE.Number,
      limit: TYPE.Number,
      sort: [TYPE.String],
    })
    .cacheControl(authenticatedRead
      ? 'private, max-age=10'
      : 'public, max-age=10')
    .return(`get${schemaName}`, {
      documents: [actualSchema.fields],
      count: TYPE.Number,
    })
    .handler(handlers.getDocuments.bind(handlers));
  if (authenticatedRead) {
    route.middleware('authMiddleware');
  }
  if (readIsEnabled)
    routesArray.push(route.build());

  let assignableFields = Object.assign({}, actualSchema.fields);
  delete assignableFields._id;
  delete assignableFields.createdAt;
  delete assignableFields.updatedAt;
  route = new RouteBuilder()
    .path(`/${schemaName}`)
    .method(ConduitRouteActions.POST)
    .bodyParams(assignableFields)
    .return(`create${schemaName}`, actualSchema.fields)
    .handler(handlers.createDocument.bind(handlers));
  const authenticatedCreate = actualSchema.modelOptions.conduit.cms.crudOperations.create.authenticated;
  const createIsEnabled = actualSchema.modelOptions.conduit.cms.crudOperations.create.enabled;
  if (authenticatedCreate) {
    route.middleware('authMiddleware');
  }
  if (createIsEnabled)
    routesArray.push(route.build());

  route = new RouteBuilder()
    .path(`/${schemaName}/many`)
    .method(ConduitRouteActions.POST)
    .bodyParams({ docs: { type: [assignableFields], required: true } })
    .return(`createMany${schemaName}`, {
      docs: [actualSchema.fields],
    })
    .handler(handlers.createManyDocuments.bind(handlers));
  if (authenticatedCreate) {
    route.middleware('authMiddleware');
  }
  if (createIsEnabled)
    routesArray.push(route.build());

  route = new RouteBuilder()
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
  const authenticatedUpdate = actualSchema.modelOptions.conduit.cms.crudOperations.update.authenticated;
  const updateIsEnabled = actualSchema.modelOptions.conduit.cms.crudOperations.update.enabled;
  if (authenticatedUpdate) {
    route.middleware('authMiddleware');
  }
  if (updateIsEnabled)
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
  if (authenticatedUpdate) {
    route.middleware('authMiddleware');
  }
  if (updateIsEnabled)
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
  if (authenticatedUpdate) {
    route.middleware('authMiddleware');
  }
  routesArray.push(route.build());

  route = new RouteBuilder()
    .path(`/${schemaName}/:id`)
    .method(ConduitRouteActions.PATCH)
    .urlParams({
      id: { type: TYPE.String, required: true },
    })
    .bodyParams(removeRequiredFields(Object.assign({}, assignableFields)))
    .return(`patch${schemaName}`, actualSchema.fields)
    .handler(handlers.patchDocument.bind(handlers));
  if (authenticatedUpdate) {
    route.middleware('authMiddleware');
  }
  if (updateIsEnabled)
    routesArray.push(route.build());
  route = new RouteBuilder()
    .path(`/${schemaName}/:id`)
    .method(ConduitRouteActions.DELETE)
    .urlParams({
      id: { type: TYPE.String, required: true },
    })
    .return(`delete${schemaName}`, TYPE.String)
    .handler(handlers.deleteDocument.bind(handlers));
  const authenticatedDelete = actualSchema.modelOptions.conduit.cms.crudOperations.delete.authenticated;
  const deleteIsEnabled = actualSchema.modelOptions.conduit.cms.crudOperations.delete.enabled;
  if (authenticatedDelete) {
    route.middleware('authMiddleware');
  }
  if (deleteIsEnabled)
    routesArray.push(route.build());

  return routesArray;
}

export function sortAndConstructRoutes(schemas: { [name: string]: any }, handlers: CmsHandlers): any[] {
  let routesArray: any[] = [];
  let schemaSort = [];
  for (const k in schemas) {
    schemaSort.push(k);
  }
  schemaSort.sort((a: string, b: string) => {
    return compareFunction(schemas[a], schemas[b]);
  });
  schemaSort.forEach((r) => {
    routesArray = routesArray.concat(getOps(r, schemas[r], handlers));
  });
  return routesArray;
}
