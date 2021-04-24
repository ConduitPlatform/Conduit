import { HttpInterface } from './http.interface';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export default async function (data: HttpInterface) {
  let config: AxiosRequestConfig = {
    url: data.options.url,
    method: data.options.method,
    headers: data.options.headers ?? undefined,
    params: data.options.params ?? undefined,
    data: data.options.body ?? undefined,
    timeout: data.options.timeout ?? undefined,
    auth: data.options.auth ?? undefined,
    maxContentLength: data.options.maxContentLength ?? undefined,
    maxBodyLength: data.options.maxBodyLength ?? undefined,
    maxRedirects: data.options.maxRedirects ?? undefined,
  };
  try {
    const response = await axios(config);
    return { data: response.data, status: response.status, headers: response.headers };
  } catch (e) {
    // handle failure properly
  }
}
