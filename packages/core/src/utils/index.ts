import { Indexable } from '@conduitplatform/grpc-sdk';

import * as deepdash from 'deepdash-es/standalone';

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
