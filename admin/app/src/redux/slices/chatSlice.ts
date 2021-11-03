import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { getChatRooms } from '../../http/ChatRequests';
import { IChatRoom } from '../../models/chat/ChatModels';

interface IChatSlice {
  data: {
    chatRooms: {
      data: IChatRoom[];
      count: number;
    };
  };
}

const initialState: IChatSlice = {
  data: {
    chatRooms: {
      data: [],
      count: 0,
    },
  },
};

export const asyncGetChatRooms = createAsyncThunk(
  'chat/getChatRooms',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const { data } = await getChatRooms(params);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearChatStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetChatRooms.fulfilled, (state, action) => {
      state.data.chatRooms.data = action.payload.chatRoomDocuments;
      state.data.chatRooms.count = action.payload.totalCount;
    });
  },
});

export default chatSlice.reducer;
export const { clearChatStore } = chatSlice.actions;
