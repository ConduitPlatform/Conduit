import axios from "axios";
import store from "../redux/store"

const CONDUIT_API = 'http://13.95.17.12';
const config = {
	masterkey: 'M4ST3RK3Y'
};

const JWT_CONFIG = (token) => ({
	...config,
	'Authorization': `JWT ${token}`
});

//Interceptors
axios.interceptors.request.use((config) => {
	if (!store) {return config}
	const token = store().getState().authenticationReducer.token;
	if (token) {
		config.headers = JWT_CONFIG(token);
	}
	return config
}, (error) => {
	return Promise.reject(error);
});

//Requests
export const getAuthUsersDataReq = (skip, limit) => axios.get(`${CONDUIT_API}/admin/users/${skip}&${limit}`);

export const loginRequest = (username, password) => axios.post(`${CONDUIT_API}/admin/login`, {
	username,
	password
}, {headers: config});
