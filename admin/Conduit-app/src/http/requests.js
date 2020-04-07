import axios from "axios";

const CONDUIT_API = 'http://13.95.17.12';
const config = {
	masterkey: 'M4ST3RK3Y'
};

export const getAuthUsersDataReq = (skip, limit) => axios.get(`${CONDUIT_API}/admin/users/${skip}&${limit}`);
export const loginRequest = (username, password) => axios.post(`${CONDUIT_API}/admin/login`, {
	username,
	password
}, {headers: config});
