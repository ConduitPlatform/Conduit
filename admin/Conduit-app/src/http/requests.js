import axios from "axios";

const COVID_API_BASE = 'https://covid-api.quintessential.gr';

export const getAuthUsersDataReq = () => axios.get(`${COVID_API_BASE}/data/country/Greece`);
