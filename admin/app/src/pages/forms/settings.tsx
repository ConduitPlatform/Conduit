import React, { ReactElement, useEffect } from 'react';
import {
  asyncGetAuthenticationConfig,
  asyncUpdateAuthenticationConfig,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import FormsSettings from '../../components/forms/FormsSettings';
import FormsLayout from '../../components/navigation/InnerLayouts/formsLayout';
import { FormSettingsConfig } from '../../models/forms/FormsModels';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { signInMethods: configData } = useAppSelector((state) => state.authenticationSlice.data);

  useEffect(() => {
    dispatch(asyncGetAuthenticationConfig());
  }, [dispatch]);

  const handleSettingsSave = (data: FormSettingsConfig) => {
    const body = {
      ...configData,
      ...data,
    };
    dispatch(asyncUpdateAuthenticationConfig(body));
  };

  return <FormsSettings handleSave={handleSettingsSave} settingsData={configData} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <FormsLayout>{page}</FormsLayout>;
};

export default Settings;
