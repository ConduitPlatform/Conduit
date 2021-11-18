import { AuthUser } from '../authentication/AuthModels';

export interface IChatConfig {
  active: boolean;
  allowMessageDelete: boolean;
  allowMessageEdit: boolean;
}

export interface IChatRoom {
  createdAt: string;
  name: string;
  participants: AuthUser[];
  updatedAt: string;
  __v: number;
  _id: string;
}

export interface IChatMessage {
  createdAt: string;
  message: string;
  readBy: string[];
  room: string;
  senderUser: AuthUser;
  updatedAt: string;
  __v: number;
  _id: string;
  loaded?: boolean;
}
