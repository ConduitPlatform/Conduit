import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { DOCUMENT_NOT_MODIFIABLE, errors } from '../errors.js';

describe('database error catalog', () => {
  it('keeps the texts other modules still match', () => {
    expect(errors.DOCUMENT_NOT_FOUND.message).toBe('Document not found');
    expect(DOCUMENT_NOT_MODIFIABLE.message).toBe(
      "Document doesn't exist or can't be modified by user.",
    );
    expect(DOCUMENT_NOT_MODIFIABLE.conduitCode).toBe('DOCUMENT_NOT_FOUND');
    expect(errors.VECTOR_INDEX_NOT_QUERYABLE.message).toMatch(/not queryable/);
    expect(errors.VECTOR_INDEX_NOT_QUERYABLE.grpcCode).toBe(status.FAILED_PRECONDITION);
  });

  it('describes every entry for API consumers', () => {
    for (const [key, definition] of Object.entries(errors)) {
      expect(definition.conduitCode).toBe(key);
      expect(definition.description?.length).toBeGreaterThan(0);
    }
  });
});
