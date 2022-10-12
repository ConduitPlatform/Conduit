export interface RedirectOptions {
  client_id: string;
  redirect_uri: string;
  response_type: string | undefined;
  response_mode?: string | undefined;
  scope: string;
  state?: string;
}
