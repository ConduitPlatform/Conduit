import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const sendSmsRequest = () => {
  return axios.post(`${CONDUIT_API}/admin/sms/send`);
};
