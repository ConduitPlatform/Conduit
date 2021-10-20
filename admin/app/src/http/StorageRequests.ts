import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IStorageConfig } from '../models/storage/StorageModels';

export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData: IStorageConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });

//name: any,
//data: any,
//folder: any,
//container: any,
//mimeType: any,
//isPublic: any
export const createStorageFile = (fileData: any) =>
  axios.post(`${CONDUIT_API}/admin/storage/file`, { ...fileData });

//name,
//container,
//isPublic
export const createStorageFolder = (folderData: any) =>
  axios.post(`${CONDUIT_API}/admin/storage/folder`, { ...folderData });

//name,
//isPublic
export const createStorageContainer = (containerData: any) =>
  axios.post(`${CONDUIT_API}/admin/storage/containers`, { ...containerData });

//skip,
//limit
export const getStorageContainers = () => axios.get(`${CONDUIT_API}/admin/storage/containers`);

//skip,
//limit,
//container,
//parent
export const getStorageFolders = () => axios.get(`${CONDUIT_API}/admin/storage/folder`);

// id, data, name, container, folder, mimeType
export const updateStorageFile = (id: any, fileData: any) =>
  axios.put(`${CONDUIT_API}/admin/storage/file/${id}`, { ...fileData });

// skip, limit, folder, container
export const getStorageFiles = () => axios.get(`${CONDUIT_API}/admin/storage/file`);

// id
export const getStorageFile = (id: any) => axios.get(`${CONDUIT_API}/admin/storage/file/${id}`);

// id
export const getStorageFileUrl = (id: any) =>
  axios.get(`${CONDUIT_API}/admin/storage/getFileUrl/${id}`);

// id
export const deleteStorageFile = (id: any) => axios.get(`${CONDUIT_API}/admin/storage/file/${id}`);
