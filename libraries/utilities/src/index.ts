import { isNil } from "lodash";
const deepdash = require('deepdash/standalone')

export class ConduitUtilities {

  constructor() {
  }

  static validateConfigFields(configInput: any, configSchema: any) {
    if (isNil(configInput)) return false;
    let result = true;

    deepdash.eachDeep(configInput, (value: any, key: string, parentValue: any, context: any) => {
      if (parentValue === undefined) return true;
      if (!this.hasOwnPropertyDeep(configSchema, context.path)) {
        result = false;
        context.break();
      }
    });
    return result;
  }

  private static hasOwnPropertyDeep(obj: any, propertyPath: string) {
    if(!propertyPath)
      return false;

    let properties = propertyPath.split('.');

    for (let i = 0; i < properties.length; i++) {
      let prop = properties[i];

      if(!obj || !obj.hasOwnProperty(prop)){
        return false;
      } else {
        obj = obj[prop];
      }
    }

    return true;
  }
}
