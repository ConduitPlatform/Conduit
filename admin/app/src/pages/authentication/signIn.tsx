import Typography from '@material-ui/core/Typography';
import React, { ReactElement, useEffect } from 'react';

import { makeStyles } from '@material-ui/core';

import { SocialDataTypes, SocialNameTypes } from '../../models/authentication/AuthModels';
import {
  asyncGetAuthenticationConfig,
  asyncUpdateAuthenticationConfig,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import AuthAccordion from '../../components/authentication/AuthAccordion';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
}));

const SignIn = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { signInMethods: configData } = useAppSelector((state) => state.authenticationSlice.data);

  useEffect(() => {
    dispatch(asyncGetAuthenticationConfig());
  }, [dispatch]);

  const handleConfigChange = (type: SocialNameTypes, newValue: SocialDataTypes) => {
    const data = {
      ...configData,
      [type]: {
        ...newValue,
      },
    };
    dispatch(asyncUpdateAuthenticationConfig(data));
  };

  return (
    <div>
      {configData ? (
        <AuthAccordion configData={configData} handleData={handleConfigChange} />
      ) : (
        <Typography>No config available</Typography>
      )}
    </div>
  );
};

SignIn.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default SignIn;
