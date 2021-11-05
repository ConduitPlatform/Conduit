export interface IChatRoom {
  createdAt: string;
  name: string;
  participants: string[];
  updatedAt: string;
  __v: number;
  _id: string;
}

export interface IChatMessage {
  createdAt: string;
  message: string;
  readBy: string[];
  room: string;
  senderUser: string;
  updatedAt: string;
  __v: number;
  _id: string;
}
