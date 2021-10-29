import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';
import PaymentSettings from '../../components/payments/PaymentSettings';
import {
  asyncGetPaymentSettings,
  asyncUpdatePaymentSettings,
} from '../../redux/slices/paymentsSlice';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { settings } = useAppSelector((state) => state.paymentsSlice.data);

  useEffect(() => {
    dispatch(asyncGetPaymentSettings());
  }, [dispatch]);

  const handleSettingsSave = (data: any) => {
    const body = {
      ...settings,
      ...data,
    };
    dispatch(asyncUpdatePaymentSettings(body));
  };

  return <PaymentSettings handleSave={handleSettingsSave} settingsData={settings} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Settings;
