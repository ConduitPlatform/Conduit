import { Indexable } from '@conduitplatform/grpc-sdk';
const deepdash = require('deepdash/standalone');

export default function parseConfigSchema(schema: Indexable) {
  deepdash.eachDeep(schema, (value: any, key: string | number, parentValue: any) => {
    if (key === 'format') {
      parentValue.type = value;
      delete parentValue[key];
    }
  });
}
