import axios from 'axios';

export class Requests {
  private readonly URL: string;
  private readonly config: {
    masterkey: string;
  };
  private token?: string;

  constructor(url: string, masterKey: string) {
    this.URL = url;
    this.config = {
      masterkey: masterKey,
    };
    const self = this;
    //Interceptors
    axios.interceptors.request.use(
      (config) => {
        const token = self.token;
        if (token) {
          config.headers = self.getJWT();
        } else {
          config.headers = self.config;
        }
        return config;
      },
      (error) => {
        console.log(error);
        return Promise.reject(error.response);
      }
    );
  }

  getJWT() {
    return {
      ...this.config,
      Authorization: `JWT ${this.token}`,
    };
  }

  setToken(token: string) {
    this.token = token;
  }

  loginRequest(username: string, password: string) {
    return axios
      .post(`${this.URL}/admin/login`, {
        username,
        password,
      })
      .then((r) => {
        this.token = r.data.token;
        return this.token;
      });
  }

  getCmsSchemasRequest(skip: number, limit: number) {
    return axios
      .get(`${this.URL}/admin/cms/schemas`, { params: { skip, limit } })
      .then((r) => r.data);
  }

  schemasFromOtherModules() {
    return axios.get(`${this.URL}/admin/cms/schemasFromOtherModules`).then((r) => r.data);
  }

  getAdminModulesRequest() {
    return axios.get(`${this.URL}/admin/config/modules`).then((r) => r.data);
  }
}
