import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import {
  createChatRoom,
  deleteChatMessages,
  getChatConfig,
  getChatMessages,
  getChatRooms,
  putChatConfig,
} from '../../http/ChatRequests';
import { IChatConfig, IChatMessage, IChatRoom } from '../../models/chat/ChatModels';

interface IChatSlice {
  config: IChatConfig;
  data: {
    chatRooms: {
      data: IChatRoom[];
      count: number;
      search: string;
    };
    chatMessages: {
      data: IChatMessage[];
      count: number;
    };
  };
}

const initialState: IChatSlice = {
  config: {
    active: false,
    allowMessageDelete: false,
    allowMessageEdit: false,
  },
  data: {
    chatRooms: {
      data: [],
      count: 0,
      search: '',
    },
    chatMessages: {
      data: [],
      count: 0,
    },
  },
};

export const asyncGetChatConfig = createAsyncThunk(
  'chat/getChatConfig',
  async (params, thunkAPI) => {
    try {
      const { data } = await getChatConfig();
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncPutChatConfig = createAsyncThunk(
  'chat/getChatConfig',
  async (params: IChatConfig, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putChatConfig(params);
      thunkAPI.dispatch(enqueueSuccessNotification('Chat config was updated successfully!'));
      thunkAPI.dispatch(setAppLoading(false));
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetChatRooms = createAsyncThunk(
  'chat/getChatRooms',
  async (params: { skip: number; limit: number; search?: string }, thunkAPI) => {
    try {
      const {
        data: { chatRoomDocuments, totalCount },
      } = await getChatRooms(params);
      console.log('chatRoomDocuments', chatRoomDocuments);
      console.log('totalCount', totalCount);
      return {
        chatRooms: chatRoomDocuments,
        count: totalCount,
        search: params.search,
      };
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetChatMessages = createAsyncThunk(
  'chat/getChatMessages',
  async (params: { skip: number; limit: number; senderId?: string; roomId?: string }, thunkAPI) => {
    try {
      const {
        data: { messages, count },
      } = await getChatMessages(params);
      return { messages: messages, count: count };
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncPostCreateChatRoom = createAsyncThunk(
  'chat/postCreateChatRoom',
  async (params: { name: string; participants: string[]; getChatRooms: () => void }, thunkAPI) => {
    try {
      await createChatRoom(params);
      params.getChatRooms();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully created chat room ${name}`));
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteChatMessages = createAsyncThunk(
  'chat/deleteChatMessages',
  async (params: { ids: string[] }, thunkAPI) => {
    try {
      await deleteChatMessages(params);
      return { deletedMessages: params.ids, count: params.ids.length };
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
    clearChatMessages: (state) => {
      state.data.chatMessages = initialState.data.chatMessages;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetChatConfig.fulfilled, (state, action) => {
      state.config = action.payload;
    });
    builder.addCase(asyncGetChatRooms.fulfilled, (state, action) => {
      state.data.chatRooms.data = [...state.data.chatRooms.data, ...action.payload.chatRooms];
      state.data.chatRooms.count = action.payload.count;
    });
    builder.addCase(asyncGetChatMessages.fulfilled, (state, action) => {
      state.data.chatMessages.data = [...state.data.chatMessages.data, ...action.payload.messages];
      state.data.chatMessages.count = action.payload.count;
    });
    builder.addCase(asyncDeleteChatMessages.fulfilled, (state, action) => {
      state.data.chatMessages.data.forEach((item, index) => {
        if (action.payload.deletedMessages.includes(item._id)) {
          state.data.chatMessages.data.splice(index, 1);
        }
      });
      state.data.chatMessages.count -= action.payload.count;
    });
  },
});

export default chatSlice.reducer;
export const { clearChatStore, clearChatMessages } = chatSlice.actions;
