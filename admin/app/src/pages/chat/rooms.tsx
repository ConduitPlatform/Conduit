import React, { ReactElement } from 'react';
import ChatRooms from '../../components/chat/ChatRooms';
import ChatLayout from '../../components/navigation/InnerLayouts/chatLayout';

const Rooms = () => {
  return <ChatRooms />;
};

Rooms.getLayout = function getLayout(page: ReactElement) {
  return <ChatLayout>{page}</ChatLayout>;
};

export default Rooms;
