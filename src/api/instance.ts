import axios from 'axios';
import type { AxiosResponse } from 'axios';
import {refreshAccessToken, signOut} from './auth';

interface CustomResponse extends AxiosResponse<{
  code: number;
  data: any;
  status: string;
}> {}

export const serializeParams = (params: Record<string, any>) => (
  `${Object.entries(params)
    .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}`
);


const instance = axios.create({
  baseURL: import.meta.env.PUBLIC_API_URL,
  paramsSerializer: serializeParams,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

const errorInterceptor = async (error: any) => {
  if (error.response.status === 401) {
    try {
      await refreshAccessToken();
      return await instance(error.config);
    } catch (e) {
      await signOut();
      localStorage.removeItem('isLoggedIn');
    }
  } else {
    return Promise.reject(error.response?.data);
  }
};

const successInterceptor = (response: CustomResponse) => response.data.data;

instance.interceptors.response.use(successInterceptor, errorInterceptor);

export default instance;