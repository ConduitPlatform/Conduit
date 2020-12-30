import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import clsx from 'clsx';
import Grid from '@material-ui/core/Grid';

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
        setLocal({
          enabled: configData.local.enabled,
          sendVerificationEmail: configData.local.sendVerificationEmail,
          verificationRequired: configData.local.verificationRequired,
          identifier: configData.local.identifier,
        });
      }
      if (configData.google) {
        setGoogle({
          enabled: configData.google.enabled,
          accountLinking: configData.google.accountLinking,
          clientId: configData.google.clientId,
        });
      }
      if (configData.facebook) {
        setFacebook({
          enabled: configData.facebook.enabled,
          accountLinking: configData.facebook.accountLinking,
          clientId: configData.facebook.clientId,
        });
      }
      if (configData.twitch) {
        setTwitch({
          enabled: configData.twitch.enabled,
          clientId: configData.twitch.clientId,
          redirect_uri: configData.twitch.redirect_uri,
          clientSecret: configData.twitch.clientSecret,
        });
      }
      if (configData.kakao) {
        setKakao({
          enabled: configData.kakao.enabled,
          clientId: configData.kakao.clientId,
          redirect_uri: configData.kakao.redirect_uri,
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
          <Accordion
            expanded={expanded.includes('local')}
            onChange={() => openExpanded('local')}
            style={{ cursor: 'default' }}
            classes={{ root: classes.expandedPanel }}>
            <AccordionSummary id={'local'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={'subtitle2'} className={classes.typography}>
                  Identifier/Password
                </Typography>
                <Typography
                  variant={'subtitle2'}
                  className={
                    local.enabled
                      ? clsx(classes.typography, classes.statusEnabled)
                      : clsx(classes.typography, classes.statusDisabled)
                  }>
                  {local.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails classes={{ root: classes.details }}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                justifyContent={'space-between'}
                alignItems={'center'}
                width={'100%'}>
                <Box
                  mb={2}
                  maxWidth={800}
                  display={'flex'}
                  width={'100%'}
                  flexDirection={'column'}
                  alignItems={'center'}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'button'} style={{ width: '100%' }}>
                      Allow users to sign up using their identifier and password.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={local.enabled}
                          onChange={() =>
                            setLocal({
                              ...local,
                              enabled: !local.enabled,
                            })
                          }
                          value={'enabled'}
                          color="primary"
                        />
                      }
                      label={providerData.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </Box>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'overline'} style={{ width: '100%' }}>
                      Send Verification Email
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={local.sendVerificationEmail}
                          onChange={() =>
                            setLocal({
                              ...local,
                              sendVerificationEmail: !local.sendVerificationEmail,
                            })
                          }
                          value={'sendVerificationEmail'}
                          color="primary"
                        />
                      }
                      label={local.sendVerificationEmail ? 'Enabled' : 'Disabled'}
                      disabled={!local.enabled}
                    />
                  </Box>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'overline'} style={{ width: '100%' }}>
                      Verification Required
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={local.verificationRequired}
                          onChange={() =>
                            setLocal({
                              ...local,
                              verificationRequired: !local.verificationRequired,
                            })
                          }
                          value={'verificationRequired'}
                          color="primary"
                        />
                      }
                      label={local.verificationRequired ? 'Enabled' : 'Disabled'}
                      disabled={!local.enabled}
                    />
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="identifier-id"
                        label="Identifier"
                        variant="outlined"
                        value={local.identifier}
                        onChange={handleIdentifier}
                        placeholder={'email'}
                        disabled={!local.enabled}
                      />
                    </Grid>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button
                    onClick={() => handleCancel('local')}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSubmit('local', local)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        );

      case 'google':
        if (!google) {
          return;
        }
        return (
          <Accordion
            expanded={expanded.includes('google')}
            onChange={() => openExpanded('google')}>
            <AccordionSummary id={'google'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={'subtitle2'} className={classes.typography}>
                  Google
                </Typography>
                <Typography
                  variant={'subtitle2'}
                  className={
                    google.enabled
                      ? clsx(classes.typography, classes.statusEnabled)
                      : clsx(classes.typography, classes.statusDisabled)
                  }>
                  {google.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails classes={{ root: classes.details }}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                justifyContent={'space-between'}
                alignItems={'center'}
                width={'100%'}>
                <Box
                  mb={2}
                  maxWidth={800}
                  display={'flex'}
                  width={'100%'}
                  flexDirection={'column'}
                  alignItems={'center'}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'button'} style={{ width: '100%' }}>
                      Allow users to sign up using their google account
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={google.enabled}
                          onChange={() =>
                            setGoogle({
                              ...google,
                              enabled: !google.enabled,
                            })
                          }
                          value={'enabled'}
                          color="primary"
                        />
                      }
                      label={providerData.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </Box>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'overline'} style={{ width: '100%' }}>
                      Allow account linking
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={google.accountLinking}
                          onChange={() =>
                            setGoogle({
                              ...google,
                              accountLinking: !google.accountLinking,
                            })
                          }
                          value={'email'}
                          color="primary"
                        />
                      }
                      label={google.accountLinking ? 'Enabled' : 'Disabled'}
                      disabled={!google.enabled}
                    />
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="google-id"
                        label="Google ID"
                        variant="outlined"
                        value={google.clientId}
                        onChange={handleGoogleClientId}
                        disabled={!google.enabled}
                      />
                    </Grid>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button
                    onClick={() => handleCancel('google')}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSubmit('google', google)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        );

      case 'facebook':
        if (!facebook) {
          return;
        }
        return (
          <Accordion
            expanded={expanded.includes('facebook')}
            onChange={() => openExpanded('facebook')}>
            <AccordionSummary id={'email'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={'subtitle2'} className={classes.typography}>
                  Facebook
                </Typography>
                <Typography
                  variant={'subtitle2'}
                  className={
                    facebook.enabled
                      ? clsx(classes.typography, classes.statusEnabled)
                      : clsx(classes.typography, classes.statusDisabled)
                  }>
                  {facebook.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails classes={{ root: classes.details }}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                justifyContent={'space-between'}
                alignItems={'center'}
                width={'100%'}>
                <Box
                  mb={2}
                  maxWidth={800}
                  display={'flex'}
                  width={'100%'}
                  flexDirection={'column'}
                  alignItems={'center'}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'button'} style={{ width: '100%' }}>
                      Allow users to sign up using their facebook account.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={facebook.enabled}
                          onChange={() =>
                            setFacebook({
                              ...facebook,
                              enabled: !facebook.enabled,
                            })
                          }
                          value={'facebook'}
                          color="primary"
                        />
                      }
                      label={facebook.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </Box>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'overline'} style={{ width: '100%' }}>
                      Allow account linking
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={facebook.accountLinking}
                          onChange={() =>
                            setFacebook({
                              ...facebook,
                              accountLinking: !facebook.accountLinking,
                            })
                          }
                          value={'accountLinking'}
                          color="primary"
                        />
                      }
                      label={facebook.accountLinking ? 'Enabled' : 'Disabled'}
                      disabled={!facebook.enabled}
                    />
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="facebook-id"
                        label="Client ID"
                        variant="outlined"
                        value={facebook.clientId}
                        onChange={handleFacebookClientID}
                        disabled={!facebook.enabled}
                      />
                    </Grid>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button
                    onClick={() => handleCancel('facebook')}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSubmit('facebook', facebook)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      case 'kakao':
        if (!kakao) {
          return;
        }
        return (
          <Accordion
            expanded={expanded.includes('kakao')}
            onChange={() => openExpanded('kakao')}>
            <AccordionSummary id={'kakao'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={'subtitle2'} className={classes.typography}>
                  Kakao Talk
                </Typography>
                <Typography
                  variant={'subtitle2'}
                  className={
                    kakao.enabled
                      ? clsx(classes.typography, classes.statusEnabled)
                      : clsx(classes.typography, classes.statusDisabled)
                  }>
                  {kakao.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails classes={{ root: classes.details }}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                justifyContent={'space-between'}
                alignItems={'center'}
                width={'100%'}>
                <Box
                  mb={2}
                  maxWidth={800}
                  display={'flex'}
                  width={'100%'}
                  flexDirection={'column'}
                  alignItems={'center'}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'button'} style={{ width: '100%' }}>
                      Allow users to sign up using their Kakao Talk account.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={kakao.enabled}
                          onChange={() =>
                            setKakao({
                              ...kakao,
                              enabled: !kakao.enabled,
                            })
                          }
                          value={'kakao'}
                          color="primary"
                        />
                      }
                      label={kakao.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="kakao-id"
                        label="Client ID"
                        variant="outlined"
                        value={kakao.clientId}
                        onChange={handleKakaoTalkClientId}
                        disabled={!kakao.enabled}
                      />
                    </Grid>
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="kakao-redirectUri-id"
                        label="Redirect Uri"
                        variant="outlined"
                        value={kakao.redirect_uri}
                        onChange={handleKakaoTalkRedirectUri}
                        disabled={!kakao.enabled}
                      />
                    </Grid>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button
                    onClick={() => handleCancel('kakao')}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSubmit('kakao', kakao)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      case 'twitch':
        if (!twitch) {
          return;
        }
        return (
          <Accordion
            expanded={expanded.includes('twitch')}
            onChange={() => openExpanded('twitch')}>
            <AccordionSummary id={'twitch'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={'subtitle2'} className={classes.typography}>
                  Twitch
                </Typography>
                <Typography
                  variant={'subtitle2'}
                  className={
                    twitch.enabled
                      ? clsx(classes.typography, classes.statusEnabled)
                      : clsx(classes.typography, classes.statusDisabled)
                  }>
                  {facebook.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails classes={{ root: classes.details }}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                justifyContent={'space-between'}
                alignItems={'center'}
                width={'100%'}>
                <Box
                  mb={2}
                  maxWidth={800}
                  display={'flex'}
                  width={'100%'}
                  flexDirection={'column'}
                  alignItems={'center'}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'button'} style={{ width: '100%' }}>
                      Allow users to sign up using their Twitch account.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={twitch.enabled}
                          onChange={() =>
                            setTwitch({
                              ...twitch,
                              enabled: !twitch.enabled,
                            })
                          }
                          value={'twitch'}
                          color="primary"
                        />
                      }
                      label={twitch.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="twitch-id"
                        label="Client ID"
                        variant="outlined"
                        value={twitch.clientId}
                        onChange={handleTwitchClientId}
                        disabled={!twitch.enabled}
                      />
                    </Grid>
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="twitch-redirectUri-id"
                        label="Redirect Uri"
                        variant="outlined"
                        value={twitch.redirect_uri}
                        onChange={handleTwitchRedirectUri}
                        disabled={!twitch.enabled}
                      />
                    </Grid>
                  </Box>
                  <Box width={'100%'} mt={2}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id="twitch-clientSecret"
                        label="Client Secret"
                        variant="outlined"
                        value={twitch.clientSecret}
                        onChange={handleTwitchClientSecret}
                        disabled={!twitch.enabled}
                      />
                    </Grid>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button
                    onClick={() => handleCancel('twitch')}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSubmit('twitch', twitch)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
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
