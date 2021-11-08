import React, { ReactElement, useEffect } from 'react';
import ChatLayout from '../../components/navigation/InnerLayouts/chatLayout';
import ChatSettings from '../../components/chat/ChatSettings';
import { asyncGetChatConfig } from '../../redux/slices/chatSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { IChatConfig } from '../../models/chat/ChatModels';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { config } = useAppSelector((state) => state.chatSlice);

  useEffect(() => {
    dispatch(asyncGetChatConfig());
  }, [dispatch]);

  const handleChatConfig = (data: IChatConfig) => {
    // dispatch(asyncSaveStorageConfig(data));
  };

  return <ChatSettings config={config} handleSave={handleChatConfig} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <ChatLayout>{page}</ChatLayout>;
};

export default Settings;
