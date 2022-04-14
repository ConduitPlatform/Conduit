import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function validateUsersInput(grpcSdk: ConduitGrpcSdk, users: any[]) {
  const uniqueUsers = Array.from(new Set(users));
  let errorMessage: string | null = null;
  const usersToBeAdded = (await grpcSdk
    .databaseProvider!.findMany('User', { _id: { $in: uniqueUsers } })
    .catch((e: Error) => {
      errorMessage = e.message;
    })) as any[];
  if (!isNil(errorMessage)) {
    return Promise.reject({ code: status.INTERNAL, message: errorMessage });
  }
  if (usersToBeAdded.length != uniqueUsers.length) {
    const dbUserIds = usersToBeAdded.map((user: any) => user._id);
    const wrongIds = uniqueUsers.filter((id) => !dbUserIds.includes(id));
    if (wrongIds.length != 0) {
      return Promise.reject({
        code: status.INVALID_ARGUMENT,
        message: `users [${wrongIds}] do not exist`,
      });
    }
  }
  return usersToBeAdded;
}

export function populateArray(pop: any) {
  if (!pop) return pop;
  if (pop.indexOf(',') !== -1) {
    pop = pop.split(',');
  } else if (Array.isArray(pop)) {
    return pop;
  } else {
    pop = [pop];
  }
  return pop;
}
