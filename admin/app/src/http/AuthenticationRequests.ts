import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const loginRequest = (username, password) =>
  axios.post(
    `${CONDUIT_API}/admin/login`,
    {
      username,
      password,
    },
    { headers: config }
  );

export const getAuthUsersDataReq = (skip, limit, search, filter) =>
  axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      skip,
      limit,
      identifier: search ? search : undefined,
      provider: filter !== 'none' ? filter : undefined,
    },
  });

export const createNewUsers = ({ email, password }) =>
  axios.post(`${CONDUIT_API}/admin/authentication/users`, {
    identification: email,
    password: password,
  });

export const editUser = (values) =>
  axios.put(`${CONDUIT_API}/admin/authentication/users/${values._id}`, {
    ...values,
  });

export const deleteUser = (id) => {
  return axios.delete(`${CONDUIT_API}/admin/authentication/users/${id}`);
};

export const searchUser = (identifier) => {
  return axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      identifier: identifier,
    },
  });
};

export const blockUser = (id) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/block`);
};

export const unblockUser = (id) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/unblock`);
};

export const getAuthenticationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/authentication`);

export const putAuthenticationConfig = (body) =>
  axios.put(`${CONDUIT_API}/admin/config/authentication`, body);
