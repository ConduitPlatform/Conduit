import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { sendSmsRequest } from '../../http/SmsRequests';
import { ISmsConfig } from '../../models/sms/SmsModels';

interface ISmsSlice {
  data: {
    config: ISmsConfig;
  };
}

const initialState: ISmsSlice = {
  data: {
    config: {
      active: false,
      providerName: '',
      twilio: {
        phoneNumber: '',
        accountSID: '',
        authToken: '',
        verify: {
          active: false,
          serviceSid: '',
        },
      },
    },
  },
};

export const asyncSendSms = createAsyncThunk('sms/sendSms', async (arg, thunkAPI) => {
  thunkAPI.dispatch(setAppLoading(true));
  try {
    const { data } = await sendSmsRequest();
    thunkAPI.dispatch(setAppDefaults());
    return data;
  } catch (error) {
    thunkAPI.dispatch(setAppLoading(false));
    thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
    throw error;
  }
});

const smsSlice = createSlice({
  name: 'sms',
  initialState,
  reducers: {
    clearSmsPageStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncSendSms.fulfilled, (state, action) => {
      //do something
    });
  },
});

export const { clearSmsPageStore } = smsSlice.actions;

export default smsSlice.reducer;
