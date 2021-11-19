import React, { ReactElement, useEffect } from 'react';
import NotificationLayout from '../../components/navigation/InnerLayouts/notificationLayout';
import NotificationSettings from '../../components/notifications/NotificationSettings';
import { INotificationSettings } from '../../models/notifications/NotificationModels';
import {
  asyncGetNotificationConfig,
  asyncSaveNotificationConfig,
} from '../../redux/slices/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { config } = useAppSelector((state) => state.notificationsSlice.data);

  useEffect(() => {
    dispatch(asyncGetNotificationConfig());
  }, [dispatch]);

  const handleConfigSave = (data: INotificationSettings) => {
    dispatch(asyncSaveNotificationConfig(data));
  };

  return <NotificationSettings handleSave={handleConfigSave} config={config} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <NotificationLayout>{page}</NotificationLayout>;
};

export default Settings;
