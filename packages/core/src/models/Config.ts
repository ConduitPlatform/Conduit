import { ConduitModel, ConduitSchema, TYPE } from '@conduit/sdk';
import { ConduitApp } from '../interfaces/ConduitApp';
import { Config } from 'convict';

export class ConfigModelGenerator {
  private appConfig: Config<any>;

  constructor(app: ConduitApp) {
    this.appConfig = (app.conduit as any).config;
  }

  private getConfigFields(parentObject: any, disabledModuleFlag: boolean = false): ConduitModel {
    const childObject: { [key: string]: any } = {};
    Object.keys(parentObject).forEach(key => {
      if (typeof parentObject[key] === 'object') {
        childObject[key] = this.getConfigFields(parentObject[key], disabledModuleFlag);
      } else {
        if (key === 'active' && parentObject[key] === false) {
          disabledModuleFlag = true;
        }
        if (key === 'doc') return;

        let type;
        switch (typeof parentObject[key]) {
          case 'string':
            type = TYPE.String;
            break;
          case 'number':
            type = TYPE.Number;
            break;
          case 'boolean':
            type = TYPE.Boolean;
            break;
          default:
            type = TYPE.String;
        }

        const defaultValue = disabledModuleFlag ? undefined : parentObject[key];
        const partialSchema: { [key: string]: any } = {};
        partialSchema[key] = {
          type,
          default: defaultValue
        };

        Object.assign(childObject, partialSchema);
      }
    });
    return childObject;
  }

  get configModel() {
    const config =  this.appConfig.get();
    const configFieldsObject = this.getConfigFields(config);
    return new ConduitSchema('Config',
      configFieldsObject,
      {timestamps: true, systemRequired: true});
  }
}
