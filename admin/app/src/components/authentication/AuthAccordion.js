import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import LocalAccordion from './LocalAccordion';
import GoogleAccordion from './GoogleAccordion';
import FacebookAccordion from './FacebookAccordion';
import KakaoAccordion from './KakaoAccordion';
import TwitchAccordion from './TwitchAccordion';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  titleContent: {
    backgroundColor: theme.palette.grey[200],
    height: theme.spacing(6),
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expandedPanel: {
    '&.MuiAccordion-root.Mui-expanded': {
      marginTop: 0,
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
    color: 'green',
  },
  statusDisabled: {
    color: 'red',
  },
}));

export default function AuthAccordion({
  configData,
  configDataError,
  handleData,
  ...rest
}) {
  const classes = useStyles();
  const [expanded, setExpanded] = useState([]);

  const [local, setLocal] = useState({
    enabled: false,
    sendVerificationEmail: false,
    verificationRequired: false,
    identifier: '',
    verification_redirect_uri: '',
    forgot_password_redirect_uri: '',
  });

  const [google, setGoogle] = useState({
    enabled: false,
    accountLinking: false,
    clientId: '',
  });

  const [facebook, setFacebook] = useState({
    enabled: false,
    accountLinking: false,
    clientId: '',
  });

  const [kakao, setKakao] = useState({
    enabled: false,
    clientId: '',
    redirect_uri: '',
  });

  const [twitch, setTwitch] = useState({
    enabled: false,
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
          clientId: twitchData.clientId || '',
          redirect_uri: twitchData.redirect_uri || '',
          clientSecret: twitchData.clientSecret || '',
        });
      }
      if (configData.kakao) {
        const kakaoData = configData.kakao;

        setKakao({
          enabled: kakaoData.enabled,
          clientId: kakaoData.clientId || '',
          redirect_uri: kakaoData.redirect_uri || '',
        });
      }
    }
  }, [configData, configDataError]);

  const handleGoogleClientId = (event) => {
    setGoogle({ ...google, clientId: event.target.value });
  };

  const handleFacebookClientID = (event) => {
    setFacebook({ ...facebook, clientId: event.target.value });
  };

  const handleKakaoTalkClientId = (event) => {
    setKakao({ ...kakao, clientId: event.target.value });
  };

  const handleKakaoTalkRedirectUri = (event) => {
    setKakao({ ...kakao, redirect_uri: event.target.value });
  };

  const handleTwitchClientId = (event) => {
    setTwitch({ ...twitch, clientId: event.target.value });
  };

  const handleTwitchRedirectUri = (event) => {
    setTwitch({ ...twitch, redirect_uri: event.target.value });
  };

  const handleTwitchClientSecret = (event) => {
    setTwitch({ ...twitch, clientSecret: event.target.value });
  };

  const handleIdentifier = (event) => {
    setLocal({ ...local, identifier: event.target.value });
  };

  const handleVerificationUriChange = (event) => {
    setLocal({ ...local, verification_redirect_uri: event.target.value });
  };

  const handleForgotPasswordUriChange = (event) => {
    setLocal({ ...local, forgot_password_redirect_uri: event.target.value });
  };

  const openExpanded = (type) => {
    if (!expanded.includes(type)) {
      const newExpanded = [...expanded];
      newExpanded.push(type);
      setExpanded(newExpanded);
    }
  };

  const closeExpanded = (type) => {
    if (type !== undefined && expanded && expanded.includes(type)) {
      const newExpanded = [...expanded];
      const arrayIndex = newExpanded.indexOf(type);
      newExpanded.splice(arrayIndex, 1);
      setExpanded(newExpanded);
    }
  };

  const handleSubmit = (type, data) => {
    handleData(type, data);
    closeExpanded(type);
  };

  const handleCancel = (type) => {
    switch (type) {
      case 'local':
        if (configData && configData.local) setLocal(configData.local);
        break;
      case 'google':
        if (configData && configData.google) setGoogle(configData.google);
        break;
      case 'facebook':
        if (configData && configData.facebook) setFacebook(configData.facebook);
        break;
      case 'twitch':
        if (configData && configData.twitch) setTwitch(configData.twitch);
        break;
      case 'kakao':
        if (configData && configData.kakao) setKakao(configData.kakao);
        break;
      default:
        return null;
    }
    closeExpanded(type);
  };

  const submitButtons = (typeProvider, provider) => {
    return (
      <>
        <Button
          onClick={() => handleCancel(typeProvider)}
          style={{ marginRight: 16 }}
          color={'primary'}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => handleSubmit(typeProvider, provider)}>
          Save
        </Button>
      </>
    );
  };

  const AccordionGenerator = (providerData) => {
    if (!providerData) {
      return;
    }
    switch (providerData) {
      case 'local':
        if (!local) {
          return;
        }
        return (
          <LocalAccordion
            local={local}
            expanded={expanded}
            setLocal={setLocal}
            providerData={providerData}
            openExpanded={openExpanded}
            handleIdentifier={handleIdentifier}
            handleVerificationUriChange={handleVerificationUriChange}
            handleForgotPasswordUriChange={handleForgotPasswordUriChange}>
            {submitButtons('local', local)}
          </LocalAccordion>
        );

      case 'google':
        if (!google) {
          return;
        }
        return (
          <GoogleAccordion
            google={google}
            expanded={expanded}
            setGoogle={setGoogle}
            providerData={providerData}
            openExpanded={openExpanded}
            handleGoogleClientId={handleGoogleClientId}>
            {submitButtons('google', google)}
          </GoogleAccordion>
        );

      case 'facebook':
        if (!facebook) {
          return;
        }
        return (
          <FacebookAccordion
            expanded={expanded}
            facebook={facebook}
            setFacebook={setFacebook}
            openExpanded={openExpanded}
            handleFacebookClientID={handleFacebookClientID}>
            {submitButtons('facebook', facebook)}
          </FacebookAccordion>
        );
      case 'kakao':
        if (!kakao) {
          return;
        }
        return (
          <KakaoAccordion
            expanded={expanded}
            kakao={kakao}
            setKakao={setKakao}
            openExpanded={openExpanded}
            handleKakaoTalkClientId={handleKakaoTalkClientId}
            handleKakaoTalkRedirectUri={handleKakaoTalkRedirectUri}>
            {submitButtons('kakao', kakao)}
          </KakaoAccordion>
        );
      case 'twitch':
        if (!twitch) {
          return;
        }
        return (
          <TwitchAccordion
            expanded={expanded}
            twitch={twitch}
            setTwitch={setTwitch}
            openExpanded={openExpanded}
            handleTwitchClientId={handleTwitchClientId}
            handleTwitchRedirectUri={handleTwitchRedirectUri}
            handleTwitchClientSecret={handleTwitchClientSecret}>
            {submitButtons('twitch', twitch)}
          </TwitchAccordion>
        );
      default:
        return null;
    }
  };

  return (
    <Box className={classes.root} {...rest}>
      <Box
        display={'flex'}
        alignItems={'center'}
        className={classes.titleContent}
        boxShadow={2}>
        <Typography variant={'subtitle2'} style={{ width: '50%', paddingLeft: 24 }}>
          Provider
        </Typography>
        <Typography variant={'subtitle2'} style={{ width: '50%' }}>
          Status
        </Typography>
      </Box>
      {AccordionGenerator('local')}
      {AccordionGenerator('google')}
      {AccordionGenerator('facebook')}
      {AccordionGenerator('kakao')}
      {AccordionGenerator('twitch')}
    </Box>
  );
}
