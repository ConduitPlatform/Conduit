import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import {
  getCustomersRequest,
  getProductsRequest,
  getSubscriptionsRequest,
  getTransactionsRequest,
  postCustomerRequest,
  postProductsRequest,
} from '../../http/PaymentsRequests';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';

interface IPaymentsSlice {
  data: {
    customers: any[];
    products: any;
    transactions: any[];
    subscriptions: any[];
  };
}

const initialState: IPaymentsSlice = {
  data: {
    customers: [],
    products: [],
    transactions: [],
    subscriptions: [],
  },
};

export const asyncGetCustomers = createAsyncThunk(
  'payments/getCustomers',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const { data } = await getCustomersRequest(params.skip, params.limit, params.search);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncCreateCustomer = createAsyncThunk(
  'payments/createCustomer',
  async (customerData: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await postCustomerRequest(customerData);
      thunkAPI.dispatch(
        enqueueSuccessNotification(`Successfully created template ${customerData.name}!`)
      );
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetProducts = createAsyncThunk(
  'notifications/saveConfig',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const { data } = await getProductsRequest(params.skip, params.limit, params.search);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncCreateProduct = createAsyncThunk(
  'payments/createCustomer',
  async (productData: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await postProductsRequest(productData);
      thunkAPI.dispatch(
        enqueueSuccessNotification(`Successfully created template ${productData.name}!`)
      );
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetTransactions = createAsyncThunk(
  'payments/getTransactions',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const { data } = await getTransactionsRequest(params.skip, params.limit, params.search);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetSubscriptions = createAsyncThunk(
  'payments/getSubscriptions',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const { data } = await getSubscriptionsRequest(params.skip, params.limit, params.search);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(asyncGetCustomers.fulfilled, (state, action) => {
      state.data.customers = action.payload;
    });
    builder.addCase(asyncGetProducts.fulfilled, (state, action) => {
      state.data.products = action.payload;
    });
    builder.addCase(asyncGetTransactions.fulfilled, (state, action) => {
      state.data.transactions = action.payload;
    });
    builder.addCase(asyncGetSubscriptions.fulfilled, (state, action) => {
      state.data.subscriptions = action.payload;
    });
  },
});

export default paymentsSlice.reducer;
