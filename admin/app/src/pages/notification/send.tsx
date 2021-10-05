import React, { ReactElement, useEffect, useState } from 'react';
import NotificationLayout from '../../components/navigation/InnerLayouts/notificationLayout';
import SendNotificationForm from '../../components/notifications/SendNotificationForm';
import { NotificationData } from '../../models/notifications/NotificationModels';
import { asyncSendNewNotification } from '../../redux/slices/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const Send = () => {
  const dispatch = useAppDispatch();

  const sendNotification = (data: NotificationData) => {
    dispatch(asyncSendNewNotification(data));
  };

  return <SendNotificationForm handleSend={sendNotification} />;
};

Send.getLayout = function getLayout(page: ReactElement) {
  return <NotificationLayout>{page}</NotificationLayout>;
};

export default Send;
