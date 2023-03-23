import { Indexable } from '@conduitplatform/grpc-sdk';

const deepdash = require('deepdash/standalone');

export default function parseConfigSchema(schema: Indexable) {
  delete schema.doc;
  deepdash.eachDeep(schema, (value: any, key: string | number, parentValue: any) => {
    if (key === 'format') {
      parentValue.type = value.charAt(0).toUpperCase() + value.slice(1);
      delete parentValue[key];
    }
  });
}
