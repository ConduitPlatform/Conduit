export interface HttpInputs {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  headers?: { [field: string]: any };
  body?: { [field: string]: any };
  params?: { [field: string]: any };
  timeout?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
  maxRedirects?: number;
  auth?: {
    username: string;
    password: string;
  };
}
