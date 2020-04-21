import { ConduitModel, ConduitSchema, TYPE } from '@conduit/sdk';
import { ConduitApp } from '../interfaces/ConduitApp';
import { Config } from 'convict';
import { isEmpty } from 'lodash';

export class ConfigModelGenerator {
  private appConfig: Config<any>;

  constructor(app: ConduitApp) {
    this.appConfig = (app.conduit as any).config;
  }

  private getConfigFields(parentObject: any): ConduitModel {
    const childObject: { [key: string]: any } = {};
    let disabledModuleFlag = false;
    Object.keys(parentObject).forEach(key => {
      if (typeof parentObject[key] === 'object') {
        const child = this.getConfigFields(parentObject[key]);
        if (isEmpty(child)) return;
        childObject[key] = child;
      } else {
        if (key === 'active' && parentObject[key] === false) {
          disabledModuleFlag = true;
          return;
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

        const partialSchema: { [key: string]: any } = {};
        partialSchema[key] = {
          type,
          default: parentObject[key]
        };

        Object.assign(childObject, partialSchema);
      }
    });
    if (disabledModuleFlag) return {};
    return childObject;
  }

  get configModel() {
    const config =  this.appConfig.get();
    const configFieldsObject = this.getConfigFields(config);
    return new ConduitSchema('Config',
      configFieldsObject,
      {timestamps: true});
  }
}
