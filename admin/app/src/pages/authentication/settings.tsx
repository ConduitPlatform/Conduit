import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core';
import { SettingsStateTypes } from '../../models/authentication/AuthModels';
import {
  asyncGetAuthenticationConfig,
  asyncUpdateAuthenticationConfig,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import authenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import AuthSettings from '../../components/authentication/AuthSettings';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
}));

const Settings = () => {
  const dispatch = useAppDispatch();

  const { signInMethods: configData } = useAppSelector(
    (state) => state.authenticationSlice.data
  );

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

  return (
    <div>
      <AuthSettings handleSave={handleSettingsSave} settingsData={configData} />;
    </div>
  );
};

Settings.Layout = authenticationLayout;

export default Settings;
