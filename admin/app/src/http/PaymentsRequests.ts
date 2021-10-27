import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const getCustomersRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/customers`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postCustomerRequest = (data: any) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const getProductsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/products`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postProductsRequest = (data: any) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const getTransactionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/transactions`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const getSubscriptionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/subscriptions`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });
