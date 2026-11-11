import { Indexable } from '@conduitplatform/grpc-sdk';
import { UserHydrator } from './hydrateUser.js';
import {
  RequestHandlers,
  SocketRequestHandlers,
  wrapRouterGrpcFunction,
} from './wrapRouterFunctions.js';

export function wrapFunctionsAsync(
  functions: { [name: string]: RequestHandlers | SocketRequestHandlers },
  routerType: 'admin' | 'client',
  hydrations: { [name: string]: { options: Indexable; hydrator: UserHydrator } } = {},
  declaredErrors: { [name: string]: ReadonlySet<string> } = {},
): {
  [name: string]: (call: Indexable, callback?: Indexable) => void;
} {
  const modifiedFunctions: {
    [name: string]: (call: Indexable, callback?: Indexable) => void;
  } = {};
  Object.keys(functions).forEach(key => {
    modifiedFunctions[key] = wrapRouterGrpcFunction(
      functions[key],
      routerType,
      hydrations[key],
      declaredErrors[key],
    );
  });
  return modifiedFunctions;
}
