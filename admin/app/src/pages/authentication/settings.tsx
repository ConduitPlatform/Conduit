import React, { ReactElement, useEffect } from 'react';
import { SettingsStateTypes } from '../../models/authentication/AuthModels';
import {
  asyncGetAuthenticationConfig,
  asyncUpdateAuthenticationConfig,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import AuthSettings from '../../components/authentication/AuthSettings';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { signInMethods: configData } = useAppSelector((state) => state.authenticationSlice.data);

  useEffect(() => {
    dispatch(asyncGetAuthenticationConfig());
  }, [dispatch]);

  const handleSettingsSave = (data: SettingsStateTypes) => {
    const body = {
      ...configData,
      ...data,
    };
    dispatch(asyncUpdateAuthenticationConfig(body));
  };

  return <AuthSettings handleSave={handleSettingsSave} settingsData={configData} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default Settings;
