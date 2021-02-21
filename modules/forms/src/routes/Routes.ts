import grpc from "grpc";
import ConduitGrpcSdk, {GrpcServer} from "@quintessential-sft/conduit-grpc-sdk";
import {isNil} from "lodash";
import axios from "axios";
import path from "path";


export class FormRoutes {
    private forms: any[] = [];

    constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {

        server.addService(path.resolve(__dirname, "./router.proto"), "forms.router.Router", {
            submitForm: this.submitForm.bind(this)
        }).catch(() => {
            console.log("Failed to register routes");
        })
    }

    async submitForm(call: any, callback: any) {
        const formName = call.request.path.split("/")[2];

        let errorMessage: any = null;
        let form = await this.grpcSdk.databaseProvider!.findOne("Forms", {name: formName}).catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(form)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: "Requested form not found",
            });
        }

        let data = JSON.parse(call.request.params);
        let fileData: any = {};
        let honeyPot: boolean = false;
        let possibleSpam: boolean = false;
        Object.keys(data).forEach(r => {
            if (form.fields[r] === "File") {
                fileData[r] = data[r]
                delete data[r];
            }
            if (isNil(form.fields[r])) {
                honeyPot = true;
            }
        });

        errorMessage = null;
        if (form.emailField && data[form.emailField]) {
            const response = await axios.get('http://api.stopforumspam.org/api',
                {
                    params: {
                        'json': true,
                        email: data[form.emailField]
                    }
                }).catch((e: any) => (errorMessage = e.message));
            if (!errorMessage && response.data?.email?.blacklisted === 1) {
                possibleSpam = true;
            }
        }

        errorMessage = null;
        if (honeyPot && possibleSpam) {
            await this.grpcSdk.databaseProvider!.create("FormReplies", {
                form: form._id,
                data,
                possibleSpam: true
            }).catch((e: any) => (errorMessage = e.message));
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            // we respond OK, but we don't send the email
            return callback(null, {result: "OK"});
        }

        errorMessage = null;
        await this.grpcSdk.databaseProvider!.create("FormReplies", {
            form: form._id,
            data
        }).catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        errorMessage = null;

        let text = "";

        Object.keys(data).forEach(r => {
            text += `</br>${r}: ${data[r]}`
        });

        await this.grpcSdk.emailProvider!.sendEmail('FormSubmission', {
            email: form.forwardTo,
            sender: 'forms',
            replyTo: form.emailField ? data[form.emailField] : null,
            variables: {
                data: text
            },
            attachments: Object.values(fileData)
        }).catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: "OK"});
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
            .register(this.forms)
            .catch((err: Error) => {
                console.log("Failed to register routes for CMS module!");
                console.error(err);
            });
    }
}
