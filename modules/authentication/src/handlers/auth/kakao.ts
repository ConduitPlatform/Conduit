import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { ConduitError } from "@quintessential-sft/conduit-grpc-sdk";
import { AuthUtils } from "../../utils/auth";
import { ISignTokenOptions } from "../../interfaces/ISignTokenOptions";
import grpc from "grpc";
import { isNil } from "lodash";
import axios from "axios";
import querystring from "querystring";
import moment from "moment";

export class KakaoHandlers {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.validate()
      .then((r) => {
        return this.initDbAndEmail();
      })
      .catch((err) => {
        console.log("Kakao not active");
      });
  }

  async validate(): Promise<Boolean> {
    return this.grpcSdk.config
      .get("authentication")
      .then((authConfig: any) => {
        if (!authConfig.kakao.enabled) {
          throw ConduitError.forbidden("Kakao auth is deactivated");
        }
        if (!authConfig.kakao || !authConfig.kakao.clientId) {
          throw ConduitError.forbidden("Cannot enable kakao auth due to missing clientId");
        }
      })
      .then(() => {
        if (!this.initialized) {
          return this.initDbAndEmail();
        }
      })
      .then((r) => {
        return true;
      })
      .catch((err: Error) => {
        // De-initialize the provider if the config is now invalid
        this.initialized = false;
        throw err;
      });
  }

  private async initDbAndEmail() {
    await this.grpcSdk.waitForExistence("database-provider");
    this.database = this.grpcSdk.databaseProvider;
    this.initialized = true;
  }

  async authenticate(call: any, callback: any) {
    // TODO redirect
    const code = JSON.parse(call.request.params).code;
    if (isNil(code))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Invalid parameters",
      });

    let errorMessage = null;

    const config = await this.grpcSdk.config.get("authentication").catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    let serverConfig = await this.grpcSdk.config.getServerConfig().catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    let url = serverConfig.url;

    let kakao_access_token = undefined;
    let expires_in = undefined;
    let userInfo = undefined;

    try {
      const response = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        querystring.stringify({
          grant_type: "authorization_code",
          client_id: config.kakao.clientId,
          redirect_uri: url + "/hook/authentication/kakao",
          code,
        })
      );

      kakao_access_token = response.data.access_token;
      expires_in = response.data.expires_in;

      const response2 = await axios.get("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${kakao_access_token}`,
        },
      });

      userInfo = response2.data;
    } catch (e) {
      errorMessage = e.message;
    }
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(userInfo)) return callback({ code: grpc.status.INTERNAL, message: "Kakao did not return user info" });

    let user = await this.database
      .findOne("User", { "kakao.id": userInfo.id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(user) && !isNil(userInfo.kakao_account) && !isNil(userInfo.kakao_account.email) ) {
        user = await this.database.findOne("User", { email: userInfo.email }).catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }

    if (isNil(user)) {
      user = await this.database
        .create("User", {
          email: userInfo?.kakao_account?.email || "",
          kakao: {
            id: userInfo.id,
            token: kakao_access_token,
            tokenExpires: moment().add(expires_in).format(),
            profile_image_url: userInfo?.kakao_account?.profile?.profile_image_url || "",
            thumbnail_image_url: userInfo?.kakao_account?.profile?.thumbnail_image_url || "",
          },
          isVerified: true,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    } else {
      if (!user.active) return callback({ code: grpc.status.PERMISSION_DENIED, message: "Inactive user" });
      if (!user.kakao) {
        user = await this.database
          .findByIdAndUpdate("User", user._id, {
            $set: {
              ["kakao"]: {
                id: userInfo.id,
                token: kakao_access_token,
                tokenExpires: moment().add(expires_in).format(),
                profile_image_url: userInfo?.kakao_account?.profile?.profile_image_url || "",
                thumbnail_image_url: userInfo?.kakao_account?.profile?.thumbnail_image_url || "",
              },
            },
          })
          .catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
    }

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    let clientId = AuthUtils.randomToken(); // TODO find a way to pass the client id

    const accessToken = await this.database
      .create("AccessToken", {
        userId: user._id,
        clientId,
        token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, "milliseconds")
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const refreshToken = await this.database
      .create("RefreshToken", {
        userId: user._id,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment().add(config.refreshTokenInvalidationPeriod, "milliseconds").toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
    redirect: config.kakao.redirect_uri + "?accessToken=" + accessToken.token + "&refreshToken=" + refreshToken.token,
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }
}
