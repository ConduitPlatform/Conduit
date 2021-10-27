import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IStorageConfig, IStorageFile } from '../models/storage/StorageModels';

export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData: IStorageConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });

//Get
export const getStorageContainers = (params: { skip: number; limit: number }) =>
  axios.get(`${CONDUIT_API}/admin/storage/container`, {
    params: {
      ...params,
    },
  });

export const getStorageFolders = (folderData: {
  skip: number;
  limit: number;
  container: string;
  parent?: string;
}) =>
  axios.get(`${CONDUIT_API}/admin/storage/folder`, {
    params: {
      ...folderData,
    },
  });

export const getStorageFiles = (fileData: {
  skip: number;
  limit: number;
  container: string;
  folder?: string;
}) =>
  axios.get(`${CONDUIT_API}/admin/storage/file`, {
    params: {
      ...fileData,
    },
  });

export const getStorageFile = (id: string) =>
  axios.get(`${CONDUIT_API}/admin/storage/file/${id}/data`);

export const getStorageFileUrl = (id: string) =>
  axios.get(`${CONDUIT_API}/admin/storage/getFileUrl/${id}`);

//Update

// export const updateStorageFile = (fileData: IStorageFile) =>
export const updateStorageFile = (
  fileData: any //not working
) => axios.put(`${CONDUIT_API}/admin/storage/file/${fileData.id}`, { ...fileData });

//Create
export const createStorageFile = (fileData: {
  name: string;
  data: string;
  folder: string;
  container: string;
  mimeType?: string;
  isPublic?: boolean;
}) => axios.post(`${CONDUIT_API}/admin/storage/file`, { ...fileData });

export const createStorageFolder = (folderData: {
  name: string;
  container: string;
  isPublic: boolean;
}) => axios.post(`${CONDUIT_API}/admin/storage/folder`, { ...folderData });

export const createStorageContainer = (containerData: { name: string; isPublic: boolean }) =>
  axios.post(`${CONDUIT_API}/admin/storage/container`, { ...containerData });

//Delete
export const deleteStorageFile = (id: string) =>
  axios.delete(`${CONDUIT_API}/admin/storage/file/${id}`);

export const deleteStorageFolder = (params: { id: string; name: string; container: string }) =>
  axios.delete(`${CONDUIT_API}/admin/storage/folder/${params.id}`, {
    data: { ...params },
  });

export const deleteStorageContainer = (params: { id: string; name: string }) =>
  axios.delete(`${CONDUIT_API}/admin/storage/container/${params.id}`, {
    data: { ...params },
  });
