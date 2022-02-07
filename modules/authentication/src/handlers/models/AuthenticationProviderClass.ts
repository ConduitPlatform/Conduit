import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { Payload } from '../interfaces/Payload';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import { ConfigController } from '../../config/Config.controller';
import { OIDCSettings } from '../interfaces/OIDCSettings';
import axios, { AxiosRequestConfig } from 'axios';

export abstract class AuthenticationProviderClass<T extends Payload> {
  private providerName: string;
  grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
  }

  abstract async validate(): Promise<Boolean>;
  abstract async connectWithProvider(call: ParsedRouterRequest): Promise<any>;
  async redirect(call: ParsedRouterRequest) {
    const params = call.request.params;
    const config = ConfigController.getInstance().config;
    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let url = serverConfig.url;
    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v12.0/oauth/access_token?',
      params: {
        client_id: config[this.providerName].clientId,
        client_secret: config[this.providerName].clientSecret,
        code: params.code,
        redirect_uri: url + call.request.path,
      },
    };
    const facebookResponse: any = await axios(facebookOptions);
    let access_token = facebookResponse.data.access_token;
    let clientId = params.state;
    return { access_token, clientId }
  }

  beginAuth(grpcSdk:  ConduitGrpcSdk,oidcSettings: OIDCSettings) {

    return async function(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
      let options = oidcSettings.getOptions;
      let retUrl = options.url;
      let length = Object.keys(options).length;
     //if (options.hasOwnProperty('state')) options['state'] = call.request.context.clientId;
      Object.keys(options).forEach((k,i) => {
        if (k !== 'url') {
          retUrl += k + '=' + options[k]
          if ( i !== length -1) retUrl += '&'
        }
      });
      return retUrl;
    }
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let payload: any;
    const config = ConfigController.getInstance().config;
    if (call.request.path.startsWith('/hook')) {
      payload = await this.redirect(call);
      call.request.params['access_token'] = payload.access_token;
      call.request.context['clientId'] = payload.clientId;
    }
    payload = await this.connectWithProvider(call);

    let user: User | null | any = null;
    if (payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        email: payload.email,
      });
    }
    else if (payload.hasOwnProperty('id') && !payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        [this.providerName]: { id: payload.id },
      });
    }
    if (!isNil(user)) {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!config[this.providerName].accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists',
        );
      }

      if (isNil(user[this.providerName])) {
        user[this.providerName] = payload;
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await User.getInstance().findByIdAndUpdate(user._id, user);
      }
    } else {
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]:  payload,
        isVerified: true,
      });
    }
    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user!._id,
        clientId: payload.clientId,
        config: config,
      },
    );

    let retObject: any = {
      userId: user!._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
    if (call.request.path.startsWith('/hook')) {
      retObject['redirect'] = config[this.providerName].redirect_uri +
          '?accessToken=' +
          (accessToken as any).token +
          '&refreshToken=' +
          (refreshToken as any).token
    }
    return retObject;
  }
}