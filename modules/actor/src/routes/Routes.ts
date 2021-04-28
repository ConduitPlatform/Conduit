import grpc from 'grpc';
import ConduitGrpcSdk, {
  GrpcServer,
  // RouterRequest,
  // RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
// import { isNil } from 'lodash';
// import axios from 'axios';

export class ActorRoutes {
  private flows: any[] = [];

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {}

  // async submitForm(call: RouterRequest, callback: RouterResponse) {
  //   const formName = call.request.path.split('/')[2];
  //
  //   let errorMessage: any = null;
  //   let flow = await this.grpcSdk
  //     .databaseProvider!.findOne('ActorFlow', { name: formName })
  //     .catch((e: any) => (errorMessage = e.message));
  //   if (!isNil(errorMessage))
  //     return callback({ code: grpc.status.INTERNAL, message: errorMessage });
  //
  //   if (isNil(flow)) {
  //     return callback({
  //       code: grpc.status.NOT_FOUND,
  //       message: 'Requested form not found',
  //     });
  //   }
  //
  //   let data = JSON.parse(call.request.params);
  //   let fileData: any = {};
  //   let honeyPot: boolean = false;
  //   let possibleSpam: boolean = false;
  //   Object.keys(data).forEach((r) => {
  //     if (flow.fields[r] === 'File') {
  //       fileData[r] = data[r];
  //       delete data[r];
  //     }
  //     if (isNil(flow.fields[r])) {
  //       honeyPot = true;
  //     }
  //   });
  //
  //   errorMessage = null;
  //   if (flow.emailField && data[flow.emailField]) {
  //     const response = await axios
  //       .get('http://api.stopforumspam.org/api', {
  //         params: {
  //           json: true,
  //           email: data[flow.emailField],
  //         },
  //       })
  //       .catch((e: any) => (errorMessage = e.message));
  //     if (!errorMessage && response.data?.email?.blacklisted === 1) {
  //       possibleSpam = true;
  //     }
  //   }
  //
  //   errorMessage = null;
  //   if (honeyPot && possibleSpam) {
  //     await this.grpcSdk
  //       .databaseProvider!.create('FormReplies', {
  //         form: flow._id,
  //         data,
  //         possibleSpam: true,
  //       })
  //       .catch((e: any) => (errorMessage = e.message));
  //     if (!isNil(errorMessage))
  //       return callback({ code: grpc.status.INTERNAL, message: errorMessage });
  //     // we respond OK, but we don't send the email
  //     return callback(null, { result: 'OK' });
  //   }
  //
  //   errorMessage = null;
  //   await this.grpcSdk
  //     .databaseProvider!.create('FormReplies', {
  //       form: flow._id,
  //       data,
  //     })
  //     .catch((e: any) => (errorMessage = e.message));
  //   if (!isNil(errorMessage))
  //     return callback({ code: grpc.status.INTERNAL, message: errorMessage });
  //   errorMessage = null;
  //
  //   let text = '';
  //
  //   Object.keys(data).forEach((r) => {
  //     text += `</br>${r}: ${data[r]}`;
  //   });
  //
  //   await this.grpcSdk
  //     .emailProvider!.sendEmail('FormSubmission', {
  //       email: flow.forwardTo,
  //       sender: 'forms',
  //       replyTo: flow.emailField ? data[flow.emailField] : null,
  //       variables: {
  //         data: text,
  //       },
  //       attachments: Object.values(fileData),
  //     })
  //     .catch((e: any) => (errorMessage = e.message));
  //   if (!isNil(errorMessage))
  //     return callback({ code: grpc.status.INTERNAL, message: errorMessage });
  //
  //   return callback(null, { result: 'OK' });
  // }

  addRoutes(routes: any[]) {
    this.flows = routes;
  }

  requestRefresh() {
    if (this.flows && this.flows.length !== 0) {
      this._refreshRoutes();
    }
  }

  private _refreshRoutes() {
    // this.grpcSdk.router
    //   .registerRouter(this.server, this.flows, {
    //     submitForm: this.submitForm.bind(this),
    //   })
    //   .catch((err: Error) => {
    //     console.log('Failed to register routes for module');
    //     console.log(err);
    //   });
  }
}
