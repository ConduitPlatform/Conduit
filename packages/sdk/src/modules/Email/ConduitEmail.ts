import { ConduitSDK } from '../../index';
import { ISendEmailParams, IRegisterTemplateParams } from './interfaces';

export abstract class IConduitEmail {
  constructor(conduit: ConduitSDK) {
  }

  abstract initModule(): Promise<{result: boolean, error?: any}>;
  abstract sendEmail(template: string, params: ISendEmailParams): Promise<any>;
  abstract registerTemplate(params: IRegisterTemplateParams): Promise<any>;
}
