import {IConduitModule} from '../../index';
import {ISendEmailParams, IRegisterTemplateParams} from './interfaces';

export interface IConduitEmail extends IConduitModule {

    sendEmail(template: string, params: ISendEmailParams): Promise<any>;

    registerTemplate(params: IRegisterTemplateParams): Promise<any>;

    setConfig(newConfig: any): Promise<any>;

}
