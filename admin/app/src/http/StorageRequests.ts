import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IStorageConfig } from '../models/storage/StorageModels';

export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData: IStorageConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });
