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
  putCustomerRequest,
  putProductRequest,
} from '../../http/PaymentsRequests';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import { Customer, Product, Subscription, Transaction } from '../../models/payments/PaymentsModels';

interface IPaymentsSlice {
  data: {
    customers: {
      customers: Customer[];
      totalCount: number;
    };
    products: {
      products: Product[];
      totalCount: number;
    };
    transactions: Transaction[];
    subscriptions: Subscription[];
  };
}

const initialState: IPaymentsSlice = {
  data: {
    customers: {
      customers: [],
      totalCount: 0,
    },
    products: {
      products: [],
      totalCount: 0,
    },
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

export const asyncSaveCustomerChanges = createAsyncThunk(
  'payment/saveCustomerChanges',
  async (dataForThunk: { _id: string; data: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const {
        data: { updatedCustomer },
      } = await putCustomerRequest(dataForThunk._id, dataForThunk.data);
      thunkAPI.dispatch(
        enqueueSuccessNotification(
          `Successfully saved changes for the template ${dataForThunk.data.name}!`
        )
      );
      thunkAPI.dispatch(setAppDefaults());
      return updatedCustomer;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetProducts = createAsyncThunk(
  'payments/getProducts',
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
  'payments/createProduct',
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

export const asyncSaveProductChanges = createAsyncThunk(
  'payments/saveProductChanges',
  async (dataForThunk: { _id: string; data: Product }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const {
        data: { updatedProduct },
      } = await putProductRequest(dataForThunk._id, dataForThunk.data);
      thunkAPI.dispatch(
        enqueueSuccessNotification(
          `Successfully saved changes for the template ${dataForThunk.data.name}!`
        )
      );
      thunkAPI.dispatch(setAppDefaults());
      return updatedProduct;
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
      state.data.customers.customers = action.payload.customerDocuments;
      state.data.customers.totalCount = action.payload.totalCount;
    });
    builder.addCase(asyncCreateCustomer.fulfilled, (state, action) => {
      state.data.customers.customers.push(action.payload.customer);
      state.data.customers.totalCount = state.data.customers.totalCount++;
    });
    builder.addCase(asyncGetProducts.fulfilled, (state, action) => {
      state.data.products.products = action.payload.productDocuments;
      state.data.products.totalCount = action.payload.totalCount;
    });
    builder.addCase(asyncCreateProduct.fulfilled, (state, action) => {
      state.data.products.products.push(action.payload.product);
      state.data.products.totalCount = state.data.products.totalCount++;
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
