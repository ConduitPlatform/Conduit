import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { Forms, FormReplies } from '../models';
import { isNil } from 'lodash';
import axios from 'axios';

export class FormRoutes {
  private forms: any[] = [];

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {}

  async submitForm(call: RouterRequest, callback: RouterResponse) {
    const formName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    let form = await Forms.getInstance()
      .findOne({ name: formName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(form)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested form not found',
      });
    }

    let data = JSON.parse(call.request.params);
    let fileData: any = {};
    let honeyPot: boolean = false;
    let possibleSpam: boolean = false;
    Object.keys(data).forEach((r) => {
      if (form.fields[r] === 'File') {
        fileData[r] = data[r];
        delete data[r];
      }
      if (isNil(form.fields[r])) {
        honeyPot = true;
      }
    });

    errorMessage = null;
    if (form.emailField && data[form.emailField]) {
      const response = await axios
        .get('http://api.stopforumspam.org/api', {
          params: {
            json: true,
            email: data[form.emailField],
          },
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!errorMessage && response.data?.email?.blacklisted === 1) {
        possibleSpam = true;
      }
    }

    errorMessage = null;
    if (honeyPot && possibleSpam) {
      await FormReplies.getInstance()
        .create({
          form: form._id,
          data,
          possibleSpam: true,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      // we respond OK, but we don't send the email
      return callback(null, { result: 'OK' });
    }

    errorMessage = null;
    await FormReplies.getInstance()
      .create({
        form: form._id,
        data,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    errorMessage = null;

    let text = '';

    Object.keys(data).forEach((r) => {
      text += `</br>${r}: ${data[r]}`;
    });

    await this.grpcSdk
      .emailProvider!.sendEmail('FormSubmission', {
        email: form.forwardTo,
        sender: 'forms',
        replyTo: form.emailField ? data[form.emailField] : null,
        variables: {
          data: text,
        },
        attachments: Object.values(fileData),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: 'OK' });
  }

  addRoutes(routes: any[]) {
    this.forms = routes;
  }

  requestRefresh() {
    if (this.forms && this.forms.length !== 0) {
      this._refreshRoutes();
    }
  }

  private _refreshRoutes() {
    this.grpcSdk.router
      .registerRouter(this.server, this.forms, {
        submitForm: this.submitForm.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }
}
