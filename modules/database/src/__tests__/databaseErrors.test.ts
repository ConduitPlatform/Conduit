import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { rethrowDatabaseError, toDatabaseError } from '../utils/databaseErrors.js';

function named(name: string, message: string, extra: object = {}) {
  const e = new Error(message);
  e.name = name;
  return Object.assign(e, extra);
}

describe('toDatabaseError', () => {
  it('maps a Mongo duplicate key to DOCUMENT_UNIQUE_CONFLICT without the value', () => {
    const cause = Object.assign(
      new Error('E11000 duplicate key error collection: x index: email_1'),
      {
        code: 11000,
        keyPattern: { email: 1 },
        keyValue: { email: 'secret@example.com' },
      },
    );
    const err = toDatabaseError(cause) as ModuleError;
    expect(err).toBeInstanceOf(ModuleError);
    expect(err.conduitCode).toBe('DOCUMENT_UNIQUE_CONFLICT');
    expect(err.code).toBe(status.ALREADY_EXISTS);
    expect(err.message).toContain('email');
    expect(err.message).not.toContain('secret@example.com');
    expect(err.debugLogInfo).toContain('E11000');
  });

  it('maps a Sequelize unique error and names the fields', () => {
    const cause = named('SequelizeUniqueConstraintError', 'Validation error', {
      errors: [{ path: 'username', value: 'bob' }],
    });
    const err = toDatabaseError(cause) as ModuleError;
    expect(err.conduitCode).toBe('DOCUMENT_UNIQUE_CONFLICT');
    expect(err.message).toContain('username');
    expect(err.message).not.toContain('bob');
  });

  it('maps a Mongoose ValidationError to DOCUMENT_VALIDATION_FAILED with its message', () => {
    const cause = named('ValidationError', 'Path `email` is required.');
    const err = toDatabaseError(cause) as ModuleError;
    expect(err.conduitCode).toBe('DOCUMENT_VALIDATION_FAILED');
    expect(err.code).toBe(status.INVALID_ARGUMENT);
    expect(err.message).toContain('Path `email` is required.');
  });

  it('passes typed and gRPC errors through untouched', () => {
    const typed = new ModuleError(errors.DOCUMENT_NOT_FOUND);
    expect(toDatabaseError(typed)).toBe(typed);
    const grpc = new GrpcError(status.NOT_FOUND, 'nope');
    expect(toDatabaseError(grpc)).toBe(grpc);
  });

  it('keeps unknown error text only in debugLogInfo', () => {
    const err = toDatabaseError(
      new Error('connection to 10.0.0.1 refused'),
    ) as ModuleError;
    expect(err.conduitCode).toBe('DATABASE_OPERATION_FAILED');
    expect(err.code).toBe(status.INTERNAL);
    expect(err.message).not.toContain('10.0.0.1');
    expect(err.debugLogInfo).toBe('connection to 10.0.0.1 refused');
  });

  it('rethrowDatabaseError throws the classified error', () => {
    expect(() => rethrowDatabaseError()(new Error('boom'))).toThrow(
      expect.objectContaining({ conduitCode: 'DATABASE_OPERATION_FAILED' }),
    );
  });
});
