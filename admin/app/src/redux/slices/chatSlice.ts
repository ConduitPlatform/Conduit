import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { getChatMessages, getChatRooms } from '../../http/ChatRequests';
import { IChatMessage, IChatRoom } from '../../models/chat/ChatModels';

interface IChatSlice {
  data: {
    chatRooms: {
      data: IChatRoom[];
      count: number;
    };
    chatMessages: {
      data: IChatMessage[];
      count: number;
      hasMore: boolean;
    };
  };
}

const initialState: IChatSlice = {
  data: {
    chatRooms: {
      data: [],
      count: 0,
    },
    chatMessages: {
      data: [],
      count: 0,
      hasMore: true,
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

export const asyncGetChatMessages = createAsyncThunk(
  'chat/getChatMessages',
  async (params: { skip: number; senderId?: string; roomId?: string }, thunkAPI) => {
    try {
      console.log('asyncGetChatMessages called');
      const {
        data: { messages, count },
      } = await getChatMessages(params);
      return { messages: messages, count: count, hasMore: messages.length > 0 };
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
    builder.addCase(asyncGetChatMessages.fulfilled, (state, action) => {
      state.data.chatMessages.data = [...state.data.chatMessages.data, ...action.payload.messages];
      state.data.chatMessages.count = action.payload.count;
      state.data.chatMessages.hasMore = action.payload.hasMore;
    });
  },
});

export default chatSlice.reducer;
export const { clearChatStore } = chatSlice.actions;
