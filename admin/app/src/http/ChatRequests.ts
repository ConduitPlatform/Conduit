import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { IChatConfig } from '../models/chat/ChatModels';

export const getChatConfig = () => axios.get(`${CONDUIT_API}/admin/config/chat`);

export const putChatConfig = (params: IChatConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/chat`, {
    ...params,
  });

export const createChatRoom = (params: { name: string; participants: string[] }) =>
  axios.post(`${CONDUIT_API}/admin/chat/room`, {
    ...params,
  });

export const getChatRooms = (params: { skip: number; search?: string }) =>
  axios.get(`${CONDUIT_API}/admin/chat/rooms`, {
    params: {
      populate: 'participants',
      limit: 15,
      ...params,
    },
  });

export const getChatMessages = (params: {
  skip: number;
  limit: number;
  senderId?: string;
  roomId?: string;
}) =>
  axios.get(`${CONDUIT_API}/admin/chat/messages`, {
    params: {
      ...params,
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
