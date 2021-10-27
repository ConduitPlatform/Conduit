import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const getCustomersRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/customer`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postCustomerRequest = (data: any) =>
  axios.post(`${CONDUIT_API}/admin/payments/customer`, { ...data });

export const putCustomerRequest = (customerId: string, data: any) =>
  axios.put(`${CONDUIT_API}/admin/payments/customer/${customerId}`, { ...data });

export const getProductsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/products`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postProductsRequest = (data: any) =>
  axios.post(`${CONDUIT_API}/admin/payments/products`, { ...data });

export const putProductRequest = (productId: string, data: any) =>
  axios.put(`${CONDUIT_API}/admin/payments/products/${productId}`, { ...data });

export const getTransactionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/transactions`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const getSubscriptionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/subscriptions`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });
