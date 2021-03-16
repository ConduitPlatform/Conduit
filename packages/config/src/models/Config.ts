import {
  ConduitModel,
  ConduitSchema,
  ConduitSDK,
  TYPE,
} from '@quintessential-sft/conduit-sdk';
import { Config } from 'convict';
import { AppConfig } from '../utils/config';
import { isNil, isPlainObject, cloneDeep, isString, isArray } from 'lodash';
const deepdash = require('deepdash/standalone');

export class ConfigModelGenerator {
  private appConfig: Config<any>;

  constructor(sdk: ConduitSDK) {
    this.appConfig = (sdk as any).config;
  }

  // private getConfigFields(parentObject: any, disabledModuleFlag: boolean = false): ConduitModel {
  //   const childObject: { [key: string]: any } = {};
  //   Object.keys(parentObject).forEach(key => {
  //     if (typeof parentObject[key] === 'object') {
  //       childObject[key] = this.getConfigFields(parentObject[key], disabledModuleFlag);
  //     } else {
  //       if (key === 'active' && parentObject[key] === false) {
  //         disabledModuleFlag = true;
  //       }
  //       if (key === 'doc') return;
  //
  //       let type;
  //       switch (typeof parentObject[key]) {
  //         case 'string':
  //           type = TYPE.String;
  //           break;
  //         case 'number':
  //           type = TYPE.Number;
  //           break;
  //         case 'boolean':
  //           type = TYPE.Boolean;
  //           break;
  //         default:
  //           type = TYPE.String;
  //       }
  //
  //       const defaultValue = disabledModuleFlag ? undefined : parentObject[key];
  //       const partialSchema: { [key: string]: any } = {};
  //       partialSchema[key] = {
  //         type,
  //         systemRequired: true,
  //         default: defaultValue
  //       };
  //
  //       Object.assign(childObject, partialSchema);
  //     }
  //   });
  //   return childObject;
  // }

  getConduitType(convictType: string) {
    switch (convictType) {
      case 'string':
        return TYPE.String;
      case 'number':
        return TYPE.Number;
      case 'boolean':
        return TYPE.Boolean;
      default:
        return TYPE.String;
    }
  }

  private getConfigFields(config: any) {
    const cloned = cloneDeep(config);

    deepdash.eachDeep(cloned, (value: any, key: any, parent: any, ctx: any) => {
      if (isNil(key)) return true;
      if (!isPlainObject(value)) return false;
      if (value.hasOwnProperty('doc')) delete value.doc;
      if (
        value.hasOwnProperty('format') &&
        (isString(value.format) || isArray(value.format))
      ) {
        let type;
        let enumType: any[] | null = null;
        switch (value['format']) {
          case 'String':
            type = TYPE.String;
            break;
          case 'Number':
            type = TYPE.Number;
            break;
          case 'Boolean':
            type = TYPE.Boolean;
            break;
          case '*':
            type = TYPE.JSON;
            break;
          default: {
            if (isArray(value.format)) {
              const internalType = this.getConduitType(typeof value.format[0]);
              type = [internalType];
              enumType = value.format;
            } else {
              type = TYPE.String;
            }
          }
        }
        value.type = type;
        if (!isNil(enumType)) {
          value.enum = enumType;
        }
        delete value.format;
      } else {
        return true;
      }
    });
    return cloned;
  }

  get configModel() {
    const config = AppConfig.getInstance().configSchema;
    const configFieldsObject = this.getConfigFields(config);
    console.log(JSON.stringify(configFieldsObject, null, 2));
    return new ConduitSchema('Config', configFieldsObject, {
      timestamps: true,
      systemRequired: true,
    });
  }
}
