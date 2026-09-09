import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import {
  assertSchemaAvailable,
  optionalDocumentId,
  parseSubscribeRequest,
  requireSchemaName,
} from '../authorize.js';

describe('realtime authorization helpers', () => {
  it('parses subscribe payloads and required schema names', () => {
    expect(parseSubscribeRequest([{ schema: 'Order', documentId: '1' }])).toEqual({
      schema: 'Order',
      documentId: '1',
    });
    expect(requireSchemaName('Order')).toBe('Order');
    expect(optionalDocumentId(undefined)).toBeUndefined();
    try {
      requireSchemaName('');
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe(status.INVALID_ARGUMENT);
    }
  });

  it('rejects missing schemas, disabled realtime, and CMS-read for clients', () => {
    const lookup = {
      getSchema: (name: string) => {
        if (name === 'Missing') return undefined;
        if (name === 'Off') {
          return { name, modelOptions: { conduit: { realtime: { enabled: false } } } };
        }
        return {
          name,
          modelOptions: {
            conduit: {
              realtime: { enabled: true },
              cms: { crudOperations: { read: { enabled: false } } },
              authorization: { enabled: true },
            },
          },
        };
      },
    };
    try {
      assertSchemaAvailable(lookup, 'Missing', true);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe(status.NOT_FOUND);
    }
    try {
      assertSchemaAvailable(lookup, 'Off', false);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe(status.FAILED_PRECONDITION);
    }
    try {
      assertSchemaAvailable(lookup, 'Order', true);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe(status.PERMISSION_DENIED);
    }
    const admin = assertSchemaAvailable(lookup, 'Order', false);
    expect(admin.authorizationEnabled).toBe(true);
  });

  it('maps adapter NOT_FOUND throws to a subscription error', () => {
    const lookup = {
      getSchema: () => {
        throw new GrpcError(status.NOT_FOUND, 'Schema Missing not defined yet');
      },
    };
    try {
      assertSchemaAvailable(lookup, 'Missing', false);
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe(status.NOT_FOUND);
      expect(err.message).toBe('Schema does not exist');
    }
  });
});
