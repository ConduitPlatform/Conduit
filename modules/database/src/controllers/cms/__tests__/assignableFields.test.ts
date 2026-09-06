import { describe, expect, it, jest } from '@jest/globals';
import {
  ConduitRouteActions,
  ConduitSchema,
  TYPE,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { CmsHandlers } from '../../../handlers/cms/crud.handler.js';
import { getAssignableCmsFields, getOps, isCmsWriteOmittedField } from '../utils.js';

const fields = {
  _id: { type: TYPE.ObjectId },
  title: { type: TYPE.String, required: true },
  body: TYPE.String,
  owner: { type: TYPE.Relation, model: 'User' },
  meta: TYPE.JSON,
  secret: { type: TYPE.String, select: false },
  embedding: {
    type: TYPE.Vector,
    dimensions: 8,
    similarity: VectorSimilarity.Cosine,
    select: false,
  },
  embeddingSourceHash: { type: TYPE.String, select: false },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

function enabledCmsSchema() {
  return new ConduitSchema('Article', fields, {
    conduit: {
      cms: {
        enabled: true,
        crudOperations: {
          create: { enabled: true, authenticated: false },
          read: { enabled: true, authenticated: false },
          update: { enabled: true, authenticated: false },
          delete: { enabled: true, authenticated: false },
        },
      },
      authorization: { enabled: false },
    },
  });
}

describe('CMS assignable fields', () => {
  it('omits vector, hash, select:false, and system fields while keeping writable types', () => {
    const assignable = getAssignableCmsFields(fields);
    expect(Object.keys(assignable).sort()).toEqual(['body', 'meta', 'owner', 'title']);
    expect(isCmsWriteOmittedField('embedding', fields.embedding)).toBe(true);
    expect(
      isCmsWriteOmittedField('embeddingSourceHash', fields.embeddingSourceHash),
    ).toBe(true);
    expect(isCmsWriteOmittedField('secret', fields.secret)).toBe(true);
    expect(
      isCmsWriteOmittedField('embedding', {
        type: TYPE.Vector,
        dimensions: 2,
      }),
    ).toBe(true);
    expect(isCmsWriteOmittedField('title', fields.title)).toBe(false);
  });

  it('keeps vector fields on CMS return projections but not create/update bodies', () => {
    const handlers = {
      getDocuments: jest.fn(),
      getDocumentById: jest.fn(),
      createDocument: jest.fn(),
      createManyDocuments: jest.fn(),
      updateManyDocuments: jest.fn(),
      patchManyDocuments: jest.fn(),
      updateDocument: jest.fn(),
      patchDocument: jest.fn(),
      deleteDocument: jest.fn(),
    } as unknown as CmsHandlers;

    const routes = getOps('Article', enabledCmsSchema(), handlers);
    const create = routes.find(
      route =>
        route.input.action === ConduitRouteActions.POST &&
        route.input.path === '/Article',
    );
    const update = routes.find(
      route =>
        route.input.action === ConduitRouteActions.UPDATE &&
        route.input.path === '/Article/:id',
    );
    const getById = routes.find(
      route =>
        route.input.action === ConduitRouteActions.GET &&
        route.input.path === '/Article/:id',
    );

    expect(create?.input.bodyParams).toMatchObject({
      title: { type: TYPE.String, required: true },
      body: TYPE.String,
      owner: { type: TYPE.Relation, model: 'User' },
      meta: TYPE.JSON,
    });
    expect(Object.keys(create?.input.bodyParams ?? {}).sort()).toEqual([
      'body',
      'meta',
      'owner',
      'title',
    ]);
    expect(create?.input.bodyParams).not.toHaveProperty('embedding');
    expect(create?.input.bodyParams).not.toHaveProperty('embeddingSourceHash');
    expect(create?.input.bodyParams).not.toHaveProperty('secret');
    expect(update?.input.bodyParams).not.toHaveProperty('embedding');
    expect(getById?.returnType.fields).toMatchObject({
      title: { type: TYPE.String, required: true },
      embedding: {
        type: TYPE.Vector,
        dimensions: 8,
        select: false,
      },
      embeddingSourceHash: { type: TYPE.String, select: false },
    });
    expect(fields.title.required).toBe(true);
  });
});
