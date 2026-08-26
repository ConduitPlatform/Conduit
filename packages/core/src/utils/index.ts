import fs from 'node:fs';
import path from 'node:path';
import { Indexable } from '@conduitplatform/grpc-sdk';

import * as deepdash from 'deepdash-es/standalone';

export function resolveProtoPath(baseDir: string, protoFile: string): string {
  const flat = path.resolve(baseDir, protoFile);
  if (fs.existsSync(flat)) {
    return flat;
  }
  return path.resolve(baseDir, '..', protoFile);
}

export default function parseConfigSchema(schema: Indexable) {
  delete schema.doc;
  deepdash.eachDeep(schema, (value: any, key: string | number, parentValue: any) => {
    if (key === 'format') {
      if (
        Object.keys(parentValue).includes('children') &&
        Object.keys(parentValue['children']).includes('format')
      ) {
        // handle Arrays
        parentValue.type = [parentValue['children'].format];
        delete parentValue['children'];
      } else {
        parentValue.type = value.charAt(0).toUpperCase() + value.slice(1);
      }
      delete parentValue[key];
    }
  });
}
