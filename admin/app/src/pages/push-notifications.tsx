import React, { SyntheticEvent, useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import DataTable from '../components/common/DataTable';
import SendNotificationForm from '../components/notifications/SendNotificationForm';
import NotificationSettings from '../components/notifications/NotificationSettings';
import {
  INotificationSettings,
  NotificationData,
} from '../models/notifications/NotificationModels';
import {
  asyncGetNotificationConfig,
  asyncSaveNotificationConfig,
  asyncSendNewNotification,
} from '../redux/slices/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const PushNotifications: React.FC = () => {
  const dispatch = useAppDispatch();

  const { config, notifications } = useAppSelector((state) => state.notificationsSlice.data);
  const [selected, setSelected] = useState(0);
  const [moduleDisabled, setModuleDisabled] = useState(false);

  useEffect(() => {
    dispatch(asyncGetNotificationConfig());
  }, [dispatch]);

  useEffect(() => {
    if (config) {
      if (config.message !== '') {
        setModuleDisabled(true);
      } else {
        setModuleDisabled(false);
        setSelected(0);
      }
    }
  }, [config]);

  const tabs = [{ title: 'Notifications' }, { title: 'Send Notifications' }, { title: 'Settings' }];

  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setSelected(newValue);
  };

  const sendNotification = (data: NotificationData) => {
    dispatch(asyncSendNewNotification(data));
  };

  const handleConfigSave = (data: INotificationSettings) => {
    dispatch(asyncSaveNotificationConfig(data));
  };

  return (
    <Box p={2}>
      <Typography variant={'h4'}>Push Notifications</Typography>
      <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
      {moduleDisabled && (
        <Box>
          <Typography variant={'h6'}>This module is not available</Typography>
        </Box>
      )}
      Notifications
      {/*{!moduleDisabled && (*/}
      {/*  <>*/}
      {/*    <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>*/}
      {/*      {notifications ? (*/}
      {/*        <DataTable dsData={notifications} />*/}
      {/*      ) : (*/}
      {/*        <Typography variant={'h6'}>No data available</Typography>*/}
      {/*      )}*/}
      {/*    </Box>*/}
      {/*    <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>*/}
      {/*      <SendNotificationForm handleSend={sendNotification} />*/}
      {/*    </Box>*/}
      {/*    <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>*/}
      {/*      <NotificationSettings handleSave={handleConfigSave} config={config ? config : null} />*/}
      {/*    </Box>*/}
      {/*  </>*/}
      {/*)}*/}
    </Box>
  );
};

export default PushNotifications;
