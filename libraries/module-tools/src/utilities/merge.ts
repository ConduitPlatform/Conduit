import { mergeWith as _mergeWith } from 'lodash-es';

export function merge<T extends object>(objA: T, objB: T) {
  const customizer = (objValue: unknown, srcValue: unknown) => {
    if (Array.isArray(objValue)) {
      // don't merge arrays
      return srcValue;
    }
  };
  return _mergeWith({}, objA, objB, customizer);
}
