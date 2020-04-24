import { ConduitSDK } from '../../index';
import { ISendEmailParams, IRegisterTemplateParams } from './interfaces';

export abstract class IConduitEmail {
  constructor(conduit: ConduitSDK) {
  }

  abstract setConfig(newConfig: any): Promise<any>;
  abstract sendEmail(template: string, params: ISendEmailParams): Promise<any>;
  abstract registerTemplate(params: IRegisterTemplateParams): Promise<any>;
}
