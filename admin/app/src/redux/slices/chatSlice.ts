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
      skip: number;
      loading: boolean;
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
      skip: 0,
      loading: false,
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
    addChatMessagesSkip: (state) => {
      state.data.chatMessages.skip += 20;
    },
    clearChatMessages: (state) => {
      state.data.chatMessages = initialState.data.chatMessages;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetChatRooms.fulfilled, (state, action) => {
      state.data.chatRooms.data = action.payload.chatRoomDocuments;
      state.data.chatRooms.count = action.payload.totalCount;
    });
    builder.addCase(asyncGetChatMessages.pending, (state) => {
      state.data.chatMessages.loading = true;
    });
    builder.addCase(asyncGetChatMessages.rejected, (state) => {
      state.data.chatMessages.loading = false;
    });
    builder.addCase(asyncGetChatMessages.fulfilled, (state, action) => {
      state.data.chatMessages.data = [...state.data.chatMessages.data, ...action.payload.messages];
      state.data.chatMessages.count = action.payload.count;
      state.data.chatMessages.hasMore = action.payload.hasMore;
      state.data.chatMessages.loading = false;
    });
  },
});

export default chatSlice.reducer;
export const { clearChatStore, clearChatMessages, addChatMessagesSkip } = chatSlice.actions;
