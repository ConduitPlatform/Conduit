import React, { ReactElement } from 'react';
import ChatLayout from '../../components/navigation/InnerLayouts/chatLayout';
import ChatSettings from '../../components/chat/ChatSettings';

const Settings = () => {
  return <ChatSettings />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <ChatLayout>{page}</ChatLayout>;
};

export default Settings;
