import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { AuthUser } from '../models/authentication/AuthModels';

export const getAuthUsersDataReq = (skip: number, limit: number, search: string, filter: string) =>
  axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      skip,
      limit,
      identifier: search ? search : undefined,
      provider: filter !== 'none' ? filter : undefined,
    },
  });

export const createNewUsers = (values: { email: string; password: string }) =>
  axios.post(`${CONDUIT_API}/admin/authentication/users`, {
    identification: values.email,
    password: values.password,
  });

export const editUser = (values: AuthUser) =>
  axios.put(`${CONDUIT_API}/admin/authentication/users/${values._id}`, {
    ...values,
  });

export const deleteUser = (id: string) => {
  return axios.delete(`${CONDUIT_API}/admin/authentication/users/${id}`);
};

export const searchUser = (identifier: string) => {
  return axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      identifier: identifier,
    },
  });
};

export const blockUser = (id: string) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/block`);
};

export const unblockUser = (id: string) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/unblock`);
};

export const getAuthenticationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/authentication`);

export const putAuthenticationConfig = (body: any) =>
  axios.put(`${CONDUIT_API}/admin/config/authentication`, body);
