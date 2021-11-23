import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import {
  deleteCustomerRequest,
  deleteProductRequest,
  deleteTransactionRequest,
  getCustomersRequest,
  getPaymentSettingsRequest,
  getProductsRequest,
  getSubscriptionsRequest,
  getTransactionsRequest,
  IRequest,
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
import { Pagination, Search } from '../../models/http/HttpModels';

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
    subscriptionData: { subscriptions: Subscription[]; count: number };
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
    subscriptionData: {
      subscriptions: [],
      count: 0,
    },
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
  async (params: Pagination & Search, thunkAPI) => {
    try {
      const { data } = await getCustomersRequest(params);
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
  async (customerData: Customer, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await postCustomerRequest(customerData);
      thunkAPI.dispatch(
        enqueueSuccessNotification(`Successfully created customer ${customerData.buyerName}!`)
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

export const asyncDeleteCustomers = createAsyncThunk(
  'emails/deleteCustomers',
  async (params: { ids: string[]; getCustomers: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteCustomerRequest(params.ids);
      params.getCustomers();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully delete customers!`));
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`Deletion of customers is currently unavailable`));
      throw error;
    }
  }
);

export const asyncGetProducts = createAsyncThunk(
  'payments/getProducts',
  async (params: Pagination & Search, thunkAPI) => {
    try {
      const { data } = await getProductsRequest(params);
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

export const asyncDeleteProducts = createAsyncThunk(
  'emails/deleteProducts',
  async (params: { ids: string[]; getProducts: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteProductRequest(params.ids);
      params.getProducts();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully deleted products!`));
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`Deletion of products is currently unavailable`));
      throw error;
    }
  }
);

export const asyncGetTransactions = createAsyncThunk(
  'payments/getTransactions',
  async (params: IRequest, thunkAPI) => {
    try {
      const { data } = await getTransactionsRequest(params);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteTransactions = createAsyncThunk(
  'emails/deleteProducts',
  async (params: { ids: string[]; getTransactions: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteTransactionRequest(params.ids);
      params.getTransactions();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully deleted transactions!`));
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(
        enqueueErrorNotification(`Deletion of transactions is currently unavailable`)
      );
      throw error;
    }
  }
);

export const asyncGetSubscriptions = createAsyncThunk(
  'payments/getSubscriptions',
  async (params: Pagination & Search, thunkAPI) => {
    try {
      const { data } = await getSubscriptionsRequest(params);
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

const updateProductByID = (updated: Product, products: Product[]) => {
  return products.map((p) => {
    if (p._id === updated._id) {
      return {
        ...updated,
      };
    } else {
      return p;
    }
  });
};

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
      state.data.customerData.customers.push(action.payload);
      state.data.customerData.count = state.data.customerData.count++;
    });
    builder.addCase(asyncGetProducts.fulfilled, (state, action) => {
      state.data.productData.products = action.payload.productDocuments;
      state.data.productData.count = action.payload.totalCount;
    });
    builder.addCase(asyncCreateProduct.fulfilled, (state, action) => {
      state.data.productData.products.push(action.payload);
      state.data.productData.count = state.data.productData.count++;
    });
    builder.addCase(asyncSaveProductChanges.fulfilled, (state, action) => {
      state.data.productData.products = updateProductByID(
        action.payload,
        state.data.productData.products
      );
    });
    builder.addCase(asyncGetTransactions.fulfilled, (state, action) => {
      state.data.transactionData.transactions = action.payload.transactionDocuments;
      state.data.transactionData.count = action.payload.totalCount;
    });
    builder.addCase(asyncGetSubscriptions.fulfilled, (state, action) => {
      state.data.subscriptionData.subscriptions = action.payload.subscriptionDocuments;
      state.data.subscriptionData.count = action.payload.totalCount;
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
