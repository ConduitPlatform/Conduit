import { HttpInputs } from './http.interface';
import axios, { AxiosRequestConfig } from 'axios';
import { ActorInput } from '../../models/ActorInput.interface';

export default async function (data: ActorInput<HttpInputs>) {
  let optionsInput = data.actorOptions;
  let config: AxiosRequestConfig = {
    url: optionsInput.url,
    method: optionsInput.method,
    headers: optionsInput.headers ?? undefined,
    params: optionsInput.params ?? undefined,
    data: optionsInput.body ?? undefined,
    timeout: optionsInput.timeout ?? undefined,
    auth: optionsInput.auth ?? undefined,
    maxContentLength: optionsInput.maxContentLength ?? undefined,
    maxBodyLength: optionsInput.maxBodyLength ?? undefined,
    maxRedirects: optionsInput.maxRedirects ?? undefined,
  };
  try {
    const response = await axios(config);
    return { data: response.data, status: response.status, headers: response.headers };
  } catch (e) {
    // handle failure properly
    throw new Error('Failed request with: ' + e.message);
  }
}
