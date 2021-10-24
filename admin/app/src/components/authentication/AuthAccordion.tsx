import React, { useEffect, useMemo, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import {
  SocialNameTypes,
  SignInMethods,
  SignInTypes,
} from '../../models/authentication/AuthModels';
import ReusableAccordion from './ReusableAccordion';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  titleContent: {
    backgroundColor: theme.palette.secondary.main,
    height: theme.spacing(6),
    color: '#000',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expandedPanel: {
    '&.MuiAccordion-root.Mui-expanded': {
      marginTop: 10,
    },
  },
  details: {
    borderTop: '1px solid',
    borderColor: 'rgb(217, 217, 217)',
  },
  typography: {
    flex: 1,
  },
  statusEnabled: {
    color: theme.palette.secondary.main,
  },
  statusDisabled: {
    color: theme.palette.primary.main,
  },
}));

interface Props {
  configData: SignInMethods;
  handleData: (type: SocialNameTypes, data: SignInTypes) => void;
}

const AuthAccordion: React.FC<Props> = ({ configData, handleData, ...rest }) => {
  const classes = useStyles();
  const [local, setLocal] = useState<SignInTypes>({
    enabled: false,
    sendVerificationEmail: false,
    accountLinking: false,
    verificationRequired: false,
    identifier: '',
    verification_redirect_uri: '',
    forgot_password_redirect_uri: '',
  });

  const [google, setGoogle] = useState<SignInTypes>({
    enabled: false,
    accountLinking: false,
    clientId: '',
  });

  const [facebook, setFacebook] = useState<SignInTypes>({
    enabled: false,
    accountLinking: false,
    clientId: '',
  });

  const [twitch, setTwitch] = useState<SignInTypes>({
    enabled: false,
    accountLinking: false,
    clientId: '',
    redirect_uri: '',
    clientSecret: '',
  });

  useEffect(() => {
    if (configData) {
      if (configData.local) {
        const localData = configData.local;

        setLocal({
          enabled: localData.enabled,
          sendVerificationEmail: localData.sendVerificationEmail,
          accountLinking: localData.accountLinking,
          verificationRequired: localData.verificationRequired,
          identifier: localData.identifier || '',
          verification_redirect_uri: localData.verification_redirect_uri || '',
          forgot_password_redirect_uri: localData.forgot_password_redirect_uri || '',
        });
      }
      if (configData.google) {
        const googleData = configData.google;

        setGoogle({
          enabled: googleData.enabled,
          accountLinking: googleData.accountLinking,
          clientId: googleData.clientId || '',
        });
      }
      if (configData.facebook) {
        const facebookData = configData.facebook;

        setFacebook({
          enabled: facebookData.enabled,
          accountLinking: facebookData.accountLinking,
          clientId: facebookData.clientId || '',
        });
      }
      if (configData.twitch) {
        const twitchData = configData.twitch;

        setTwitch({
          enabled: twitchData.enabled,
          accountLinking: twitchData.accountLinking,
          clientId: twitchData.clientId || '',
          redirect_uri: twitchData.redirect_uri || '',
          clientSecret: twitchData.clientSecret || '',
        });
      }
    }
  }, [configData]);

  const localMemo = useMemo(() => {
    return (
      <ReusableAccordion
        name={'local'}
        accProps={local}
        setAccProps={setLocal}
        configData={configData}
        handleData={handleData}
      />
    );
  }, [local, configData, handleData]);

  const googleMemo = useMemo(() => {
    return (
      <ReusableAccordion
        name={'google'}
        accProps={google}
        setAccProps={setGoogle}
        configData={configData}
        handleData={handleData}
      />
    );
  }, [google, configData, handleData]);

  const facebookMemo = useMemo(() => {
    return (
      <ReusableAccordion
        name={'facebook'}
        accProps={facebook}
        setAccProps={setFacebook}
        configData={configData}
        handleData={handleData}
      />
    );
  }, [facebook, configData, handleData]);

  const twitchMemo = useMemo(() => {
    return (
      <ReusableAccordion
        name={'twitch'}
        accProps={twitch}
        setAccProps={setTwitch}
        configData={configData}
        handleData={handleData}
      />
    );
  }, [twitch, configData, handleData]);

  return (
    <Box className={classes.root} {...rest}>
      <Box display={'flex'} alignItems={'center'} className={classes.titleContent} boxShadow={2}>
        <Typography variant={'subtitle2'} style={{ width: '50%', paddingLeft: 24 }}>
          Provider
        </Typography>
        <Typography variant={'subtitle2'} style={{ width: '50%' }}>
          Status
        </Typography>
      </Box>
      {localMemo}
      {googleMemo}
      {facebookMemo}
      {twitchMemo}
    </Box>
  );
};

export default AuthAccordion;
