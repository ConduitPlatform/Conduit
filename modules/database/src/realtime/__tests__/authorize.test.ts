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
    expect(() => requireSchemaName('')).toThrow(
      expect.objectContaining({ code: status.INVALID_ARGUMENT }),
    );
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
    expect(() => assertSchemaAvailable(lookup, 'Missing', true)).toThrow(
      expect.objectContaining({ code: status.NOT_FOUND }),
    );
    expect(() => assertSchemaAvailable(lookup, 'Off', false)).toThrow(
      expect.objectContaining({ code: status.FAILED_PRECONDITION }),
    );
    expect(() => assertSchemaAvailable(lookup, 'Order', true)).toThrow(
      expect.objectContaining({ code: status.PERMISSION_DENIED }),
    );
    const admin = assertSchemaAvailable(lookup, 'Order', false);
    expect(admin.authorizationEnabled).toBe(true);
  });

  it('maps adapter NOT_FOUND throws to a subscription error', () => {
    const lookup = {
      getSchema: () => {
        throw new GrpcError(status.NOT_FOUND, 'Schema Missing not defined yet');
      },
    };
    expect(() => assertSchemaAvailable(lookup, 'Missing', false)).toThrow(
      expect.objectContaining({
        code: status.NOT_FOUND,
        message: 'Schema does not exist',
      }),
    );
  });
});
