import { ConduitSDK, IRegisterTemplateParams, ISendEmailParams } from '@conduit/sdk';
import { isNil } from 'lodash';
import { EmailProvider } from '@conduit/email-provider';

export class EmailService {
  constructor(
    private readonly emailer: EmailProvider,
    private readonly sdk: ConduitSDK
  ) {
  }

  async registerTemplate(params: IRegisterTemplateParams) {
    const {
      name,
      body,
      subject,
      variables
    } = params;

    const database = this.sdk.getDatabase();

    const TemplateSchema = database.getSchema('EmailTemplate');

    const existing = await TemplateSchema.findOne({name});
    if (!isNil(existing)) return existing;

    return TemplateSchema.create({
      name,
      subject,
      body,
      variables
    });
  }

  async sendEmail(template: string, params: ISendEmailParams) {
    const {
      email,
      variables,
      sender
    } = params;

    const builder = this.emailer.emailBuilder();
    const database = this.sdk.getDatabase();

    const TemplateSchema = database.getSchema('EmailTemplate');

    const templateFound = await TemplateSchema.findOne({ name: template });
    if (isNil(templateFound)) {
      throw new Error(`Template ${template} not found`);
    }

    const bodyString = this.replaceVars(templateFound.body, variables);
    const subjectString = this.replaceVars(templateFound.subject, variables);

    builder.setSender(sender);
    builder.setContent(bodyString);
    builder.setReceiver(email);
    builder.setSubject(subjectString);

    return this.emailer.sendEmail(builder);
  }

  private replaceVars(body: string, variables: { [key: string]: any }) {
    let str = body;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      let value = variables[key];
      if (Array.isArray(value)) {
        value = value.toString();
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      str = str.replace(regex, value);
    });
    return str;
  }
}
