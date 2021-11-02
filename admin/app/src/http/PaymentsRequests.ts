import axios from 'axios';
import { Customer, PaymentSettings, Product } from '../models/payments/PaymentsModels';
import { CONDUIT_API } from './requestsConfig';

export const getCustomersRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/customer`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postCustomerRequest = (data: Customer) =>
  axios.post(`${CONDUIT_API}/admin/payments/customer`, { ...data });

export const putCustomerRequest = (customerId: string, data: Customer) =>
  axios.put(`${CONDUIT_API}/admin/payments/customer/${customerId}`, { ...data });

export const getProductsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/products`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const postProductsRequest = (data: Product) =>
  axios.post(`${CONDUIT_API}/admin/payments/products`, { ...data });

export const putProductRequest = (productId: string, data: Product) =>
  axios.put(`${CONDUIT_API}/admin/payments/products/${productId}`, { ...data });

export const getTransactionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/transactions`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const getSubscriptionsRequest = (skip: number, limit: number, search?: string) =>
  axios.get(`${CONDUIT_API}/admin/payments/subscription`, {
    params: { skip, limit, search: search !== '' ? search : undefined },
  });

export const getPaymentSettingsRequest = () => axios.get(`${CONDUIT_API}/admin/config/payments`);

export const putPaymentSettingsRequest = (data: PaymentSettings) =>
  axios.put(`${CONDUIT_API}/admin/config/payments`, { ...data });
