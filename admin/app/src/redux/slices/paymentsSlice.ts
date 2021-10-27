import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import {
  getCustomersRequest,
  getPaymentSettingsRequest,
  getProductsRequest,
  getSubscriptionsRequest,
  getTransactionsRequest,
  postCustomerRequest,
  postProductsRequest,
  putCustomerRequest,
  putPaymentSettingsRequest,
  putProductRequest,
} from '../../http/PaymentsRequests';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import {
  Customer,
  PaymentSettings,
  Product,
  Subscription,
  Transaction,
} from '../../models/payments/PaymentsModels';

interface IPaymentsSlice {
  data: {
    customerData: {
      customers: Customer[];
      count: number;
    };
    productData: {
      products: Product[];
      count: number;
    };
    transactionData: {
      transactions: Transaction[];
      count: number;
    };
    subscriptions: Subscription[];
    settings: PaymentSettings;
  };
}

const initialState: IPaymentsSlice = {
  data: {
    customerData: {
      customers: [],
      count: 0,
    },
    productData: {
      products: [],
      count: 0,
    },
    transactionData: {
      transactions: [],
      count: 0,
    },
    subscriptions: [],
    settings: {
      active: false,
      stripe: {
        enabled: false,
        secret_key: '',
      },
    },
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
        enqueueSuccessNotification(`Successfully created customer ${customerData.name}!`)
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
          `Successfully saved changes for the customer ${dataForThunk.data.name}!`
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
        enqueueSuccessNotification(`Successfully created product ${productData.name}!`)
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
          `Successfully saved changes for the product ${dataForThunk.data.name}!`
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

export const asyncGetPaymentSettings = createAsyncThunk(
  'authentication/getConfig',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getPaymentSettingsRequest();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncUpdatePaymentSettings = createAsyncThunk(
  'authentication/updateConfig',
  async (body: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putPaymentSettingsRequest(body);
      thunkAPI.dispatch(setAppDefaults());
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
      state.data.customerData.customers = action.payload.customerDocuments;
      state.data.customerData.count = action.payload.totalCount;
    });
    builder.addCase(asyncCreateCustomer.fulfilled, (state, action) => {
      state.data.customerData.customers.push(action.payload.customer);
      state.data.customerData.count = state.data.customerData.count++;
    });
    builder.addCase(asyncGetProducts.fulfilled, (state, action) => {
      state.data.productData.products = action.payload.productDocuments;
      state.data.productData.count = action.payload.totalCount;
    });
    builder.addCase(asyncCreateProduct.fulfilled, (state, action) => {
      state.data.productData.products.push(action.payload.product);
      state.data.productData.count = state.data.productData.count++;
    });
    builder.addCase(asyncGetTransactions.fulfilled, (state, action) => {
      state.data.transactionData.transactions = action.payload.transactionDocuments;
      state.data.transactionData.count = action.payload.totalCount;
    });
    builder.addCase(asyncGetSubscriptions.fulfilled, (state, action) => {
      state.data.subscriptions = action.payload;
    });
    builder.addCase(asyncGetPaymentSettings.fulfilled, (state, action) => {
      state.data.settings = action.payload;
    });
    builder.addCase(asyncUpdatePaymentSettings.fulfilled, (state, action) => {
      state.data.settings = action.payload;
    });
  },
});

export default paymentsSlice.reducer;
