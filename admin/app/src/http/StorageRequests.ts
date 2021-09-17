import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });
