import { ConduitSDK } from '../../index';
import { ISendEmailParams, IRegisterTemplateParams } from './interfaces';

export abstract class IConduitEmail {
  constructor(conduit: ConduitSDK) {
  }

  abstract validateConfig(config: any): boolean;
  abstract initModule(): Promise<boolean>;
  abstract sendEmail(template: string, params: ISendEmailParams): Promise<any>;
  abstract registerTemplate(params: IRegisterTemplateParams): Promise<any>;
}
