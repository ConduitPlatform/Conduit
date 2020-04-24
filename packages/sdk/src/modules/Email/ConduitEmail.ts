import { ConduitSDK, IConduitModule } from '../../index';
import { ISendEmailParams, IRegisterTemplateParams } from './interfaces';

export abstract class IConduitEmail implements IConduitModule{
  constructor(conduit: ConduitSDK) {
  }

  abstract sendEmail(template: string, params: ISendEmailParams): Promise<any>;
  abstract registerTemplate(params: IRegisterTemplateParams): Promise<any>;
  abstract setConfig(newConfig: any): Promise<any>;

}
