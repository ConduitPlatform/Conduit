import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';

export const createChatRoom = (params: { name: string; participants: string[] }) =>
  axios.post(`${CONDUIT_API}/admin/chat/room`, {
    ...params,
  });

export const getChatRooms = (params: { skip: number; limit: number; search?: string }) =>
  axios.get(`${CONDUIT_API}/admin/chat/rooms`, {
    params: {
      ...params,
    },
  });

export const getChatMessages = (params: { skip: number; senderId?: string; roomId?: string }) =>
  axios.get(`${CONDUIT_API}/admin/chat/messages`, {
    params: {
      ...params,
      limit: 10,
    },
  });

export const deleteChatRooms = (params: { ids: string[] }) =>
  axios.delete(`${CONDUIT_API}/admin/chat/rooms`, {
    data: {
      ...params,
    },
  });

export const deleteChatMessages = (params: { ids: string[] }) =>
  axios.delete(`${CONDUIT_API}/admin/chat/messages`, {
    data: {
      ...params,
    },
  });
