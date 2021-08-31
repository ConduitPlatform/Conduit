import React, { ChangeEvent } from 'react';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Accordion from '@material-ui/core/Accordion';
import { makeStyles } from '@material-ui/core/styles';
import { InputLabel, MenuItem, Select } from '@material-ui/core';
import FormControl from '@material-ui/core/FormControl';
import { LocalTypes, SocialNameTypes } from './AuthModels';

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

interface Props {
  expanded: SocialNameTypes[];
  local: LocalTypes;
  setLocal: (values: LocalTypes) => void;
  openExpanded: (value: SocialNameTypes) => void;
  handleIdentifier: (
    event: React.ChangeEvent<{ name?: string; value: unknown }>,
    child: React.ReactNode
  ) => void;
  handleVerificationUriChange: (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => void;
  handleForgotPasswordUriChange: (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => void;
}

const LocalAccordion: React.FC<Props> = ({
  local,
  expanded,
  children,
  setLocal,
  openExpanded,
  handleIdentifier,
  handleVerificationUriChange,
  handleForgotPasswordUriChange,
}) => {
  const classes = useStyles();

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
                label={local.enabled ? 'Enabled' : 'Disabled'}
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
                disabled={!local.enabled || local.identifier === 'username'}
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
                disabled={!local.enabled || local.identifier === 'username'}
              />
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel id="identifier-label">Identifier</InputLabel>
                  <Select
                    id="identifier-id"
                    labelId="identifier-label"
                    style={{ width: '100%', marginBottom: 8 }}
                    value={local.identifier}
                    placeholder={'email'}
                    disabled={!local.enabled}
                    onChange={handleIdentifier}
                    label="Identifier">
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    <MenuItem value={'email'}>email</MenuItem>
                    <MenuItem value={'username'}>username</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="verification_redirect_uri"
                  label="Verification Redirect Uri"
                  variant="outlined"
                  value={local.verification_redirect_uri}
                  onChange={handleVerificationUriChange}
                  placeholder={'verification_redirect_uri'}
                  disabled={!local.enabled || local.identifier === 'username'}
                />
              </Grid>
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="forgot_password_redirect_uri"
                  label="Forgot Password Uri"
                  variant="outlined"
                  value={local.forgot_password_redirect_uri}
                  onChange={handleForgotPasswordUriChange}
                  placeholder={'forgot_password_redirect_uri'}
                  disabled={!local.enabled || local.identifier === 'username'}
                />
              </Grid>
            </Box>
          </Box>
          <Box alignSelf={'flex-end'}>{children}</Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default LocalAccordion;
