export interface AuthParams {
  client_id: string;
  client_secret: string;
  code: string;
  redirect_uri: string;
  grant_type?: string;
  code_verifier?: string;
}

export type AuthParamsKey = keyof AuthParams;
