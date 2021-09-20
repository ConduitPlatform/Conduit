import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IPlatformTypes } from '../models/settings/SettingsModels';

export const getAvailableClientsRequest = () => {
  return axios.get(`${CONDUIT_API}/admin/security/client`);
};

export const generateNewClientRequest = (platform: IPlatformTypes) => {
  return axios.post(`${CONDUIT_API}/admin/security/client`, { platform });
};

export const deleteClientRequest = (_id: string) => {
  return axios.delete(`${CONDUIT_API}/admin/security/client/${_id}`);
};

export const putCoreRequest = (data: any) => {
  return axios.put(`${CONDUIT_API}/config/core`, data);
};

export const getAdminModulesRequest = () => {
  return axios.get(`${CONDUIT_API}/admin/config/modules`);
};

export const getServiceAccounts = () => {
  return axios.get(`${CONDUIT_API}/admin/authentication/services`);
};

export const deleteServiceAccounts = (_id: string) => {
  return axios.delete(`${CONDUIT_API}/admin/authentication/services/${_id}`);
};

export const createServiceAccount = (name: string) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/services`, { name });
};

export const refreshServiceAccount = (serviceId: string) => {
  return axios.put(`${CONDUIT_API}/admin/authentication/services`, { serviceId });
};

export const postNewAdminUser = (endpointData: {
  username: string;
  password: string;
}) => {
  return axios.post(`${CONDUIT_API}/admin/create`, endpointData);
};
