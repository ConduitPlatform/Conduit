import { Indexable } from '@conduitplatform/grpc-sdk';
import { User } from '../models/index.js';
import { getUserCache } from './sessionServices.js';
import {
  createGetUserHandler,
  createUserResolver,
  hiddenUserFields,
} from './userResolver.logic.js';

/**
 * Read-through user lookup (Redis user cache, then the User model): behind the GetUser
 * rpc, the local module-tools resolver and the jwt-mode middleware. Rejects with a
 * GrpcError NOT_FOUND for an unknown id; never returns hashedPassword or a select:false
 * field.
 */
export const resolveUserById: (userId: string) => Promise<Indexable> = createUserResolver(
  {
    findUser: id =>
      User.getInstance().findOne({ _id: id }, { readPreference: 'primary' }),
    cache: getUserCache,
    hiddenFields: () => hiddenUserFields(User.getInstance().fields),
  },
);

/** The GetUser rpc handler. */
export const getUserHandler = createGetUserHandler(resolveUserById);
