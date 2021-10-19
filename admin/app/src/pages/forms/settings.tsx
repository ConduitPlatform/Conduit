import React, { ReactElement, useEffect } from 'react';
import {
  asyncGetAuthenticationConfig,
  asyncUpdateAuthenticationConfig,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import FormsSettings from '../../components/forms/FormsSettings';
import FormsLayout from '../../components/navigation/InnerLayouts/formsLayout';
import { FormSettingsConfig } from '../../models/forms/FormsModels';
import { asyncEditFormsConfig, asyncGetFormsConfig } from '../../redux/slices/formsSlice';

const Settings = () => {
  const dispatch = useAppDispatch();

  const { config: formsConfig } = useAppSelector((state) => state.formsSlice.data);

  useEffect(() => {
    dispatch(asyncGetFormsConfig());
  }, [dispatch]);

  const handleSettingsSave = (data: FormSettingsConfig) => {
    const config = {
      ...formsConfig,
      ...data,
    };
    dispatch(asyncEditFormsConfig(config));
  };

  return <FormsSettings handleSave={handleSettingsSave} settingsData={formsConfig} />;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <FormsLayout>{page}</FormsLayout>;
};

export default Settings;
