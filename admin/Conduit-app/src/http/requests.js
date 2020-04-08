import axios from "axios";

const CONDUIT_API = 'http://13.95.17.12';
const config = {
	masterkey: 'M4ST3RK3Y'
};

const JWT_CONFIG = (token) => ({
	...config,
	'Authorization': `JWT ${token}`
});

export const getAuthUsersDataReq = (token, skip, limit) => axios.get(`${CONDUIT_API}/admin/users/${skip}&${limit}`, {
	headers: JWT_CONFIG(token)
});

export const loginRequest = (username, password) => axios.post(`${CONDUIT_API}/admin/login`, {
	username,
	password
}, {headers: config});
