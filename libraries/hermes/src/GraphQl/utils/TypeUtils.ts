import { Indexable } from '@conduitplatform/grpc-sdk';

const deepdash = require('deepdash/standalone');

function _extractNestedPopulation(path: string) {
  const paths = path.split('.');
  while (paths.indexOf('fieldsByTypeName') !== -1) {
    paths.splice(paths.indexOf('fieldsByTypeName'), 2);
  }
  path = paths.join('.');
  return path;
}

export function findPopulation(
  fields: Indexable,
  relations: string[],
): string[] | undefined {
  if (relations.length === 0) return undefined;
  const result: string[] = [];
  deepdash.eachDeep(
    fields,
    (value: Indexable, key: string, parent: Indexable, context: Indexable) => {
      if (value.fieldsByTypeName) {
        const keys = Object.keys(value.fieldsByTypeName);
        if (
          keys.length > 0 &&
          relations.indexOf(keys[0]) !== -1 &&
          result.indexOf(key) === -1 &&
          !context.obj[key]
        ) {
          let path = context._item.strPath;
          path = path.split('.')[0];
          if (context.obj[path]) {
            result.push(
              _extractNestedPopulation(
                context._item.strPath.substring(context._item.strPath.indexOf('.') + 1),
              ),
            );
          } else {
            result.push(_extractNestedPopulation(context._item.strPath));
          }
        }
      }
    },
  );
  return result;
}
