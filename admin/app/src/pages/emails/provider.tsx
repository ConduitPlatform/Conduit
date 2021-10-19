import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch } from '../../redux/store';
import EmailsLayout from '../../components/navigation/InnerLayouts/emailsLayout';
import { asyncGetEmailSettings, asyncUpdateEmailSettings } from '../../redux/slices/emailsSlice';
import ProviderData from '../../components/emails/ProviderData';
import { EmailSettings } from '../../models/emails/EmailModels';

const SendEmail = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(asyncGetEmailSettings());
  }, [dispatch]);

  const saveSettings = (data: EmailSettings) => {
    dispatch(asyncUpdateEmailSettings(data));
  };

  return <ProviderData handleSave={saveSettings} />;
};

SendEmail.getLayout = function getLayout(page: ReactElement) {
  return <EmailsLayout>{page}</EmailsLayout>;
};

export default SendEmail;
