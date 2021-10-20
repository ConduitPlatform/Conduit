import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IStorageConfig, IStorageFile } from '../models/storage/StorageModels';

export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData: IStorageConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });

export const createStorageFile = (fileData: any) =>
  axios.post(`${CONDUIT_API}/admin/storage/file`, { ...fileData });

export const createStorageFolder = (folderData: {
  name: string;
  container: string;
  isPublic: boolean;
}) => axios.post(`${CONDUIT_API}/admin/storage/folder`, { ...folderData });

export const createStorageContainer = (body: { name: string; isPublic: boolean }) =>
  axios.post(`${CONDUIT_API}/admin/storage/containers`, { ...body });

export const getStorageContainers = (params: { skip: number; limit: number }) =>
  axios.get(`${CONDUIT_API}/admin/storage/containers`, {
    params: {
      ...params,
    },
  });

export const getStorageFolders = (folderData: {
  skip: number;
  limit: number;
  container: string;
  parent: string;
}) =>
  axios.get(`${CONDUIT_API}/admin/storage/folder`, {
    params: {
      ...folderData,
    },
  });

export const updateStorageFile = (fileData: IStorageFile) =>
  axios.put(`${CONDUIT_API}/admin/storage/file/${fileData.id}`, { ...fileData });

export const getStorageFiles = (fileData: {
  skip: number;
  limit: number;
  folder: string;
  container: string;
}) =>
  axios.get(`${CONDUIT_API}/admin/storage/file`, {
    params: {
      ...fileData,
    },
  });

export const getStorageFile = (id: string) => axios.get(`${CONDUIT_API}/admin/storage/file/${id}`);

export const getStorageFileUrl = (id: string) =>
  axios.get(`${CONDUIT_API}/admin/storage/getFileUrl/${id}`);

export const deleteStorageFile = (id: string) =>
  axios.get(`${CONDUIT_API}/admin/storage/file/${id}`);
