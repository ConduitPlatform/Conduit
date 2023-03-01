import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { FormReplies, Forms } from '../models';
import { isNil } from 'lodash';
import axios from 'axios';

export class FormsRoutes {
  public readonly _routingManager: RoutingManager;
  private forms: UntypedArray = [];

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
  }

  async submitForm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const formId = call.request.path.split('/')[2];
    const form = await Forms.getInstance()
      .findOne({ _id: formId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!form) {
      throw new GrpcError(status.NOT_FOUND, 'Form does not exist');
    }

    const data = call.request.params;
    const fileData: any = {};
    let honeyPot: boolean = false;
    let possibleSpam: boolean = false;
    Object.keys(data).forEach(r => {
      if (form.fields[r] === 'File') {
        fileData[r] = data[r];
        delete data[r];
      }
      if (isNil(form.fields[r])) {
        honeyPot = true;
      }
    });
    if (form.emailField && data[form.emailField]) {
      const response = await axios
        .get('https://api.stopforumspam.org/api', {
          params: {
            json: true,
            email: data[form.emailField],
          },
        })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      if (response.data?.email?.blacklisted === 1) {
        possibleSpam = true;
      }
    }
    if (honeyPot && possibleSpam) {
      await FormReplies.getInstance()
        .create({
          form: form._id,
          data,
          possibleSpam: true,
        })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      // we respond OK, but we don't send the email
      return 'Ok';
    }

    await FormReplies.getInstance()
      .create({
        form: form._id,
        data,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    let text = '';
    Object.keys(data).forEach(r => {
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
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'Ok';
  }

  requestRefresh() {
    this._routingManager.registerRoutes();
  }
}
