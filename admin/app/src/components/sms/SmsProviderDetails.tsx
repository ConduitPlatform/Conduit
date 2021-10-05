import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Clear, Send } from '@material-ui/icons';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import MenuItem from '@material-ui/core/MenuItem';
import Switch from '@material-ui/core/Switch';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(1, 1),
    color: theme.palette.text.secondary,
  },
  fieldSpace: {
    marginTop: theme.spacing(1.5),
  },
  divider: {
    margin: theme.spacing(2, 0),
  },
}));

const config = {
  active: true,
  providerName: 'twilio',
  twilio: {
    verify: {
      active: true,
      serviceSid: '***REMOVED***',
    },
    phoneNumber: '***REMOVED***',
    accountSID: '***REMOVED***',
    authToken: '***REMOVED***',
  },
  twilio2: {
    verify: {
      active: false,
      serviceSid: 'prodsprods',
    },
    phoneNumber: '***REMOVED***',
    accountSID: 'prodsprodsprods',
    authToken: 'prodsprodsprodsprods',
  },
};

const SmsProviderDetails: React.FC = () => {
  const classes = useStyles();

  const [number, setNumber] = useState<string>('');
  const [accountSID, setAccountSID] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');
  const [serviceID, setServiceID] = useState<string>('');
  const [verify, setVerify] = useState<boolean>(false);
  const [provider, setProvider] = useState<string>('');

  useEffect(() => {
    const selected = config.providerName;
    setProvider(selected);
  }, []);

  const prepareValues = useCallback(
    (config: any) => {
      if (provider) {
        setNumber(config[provider].phoneNumber);
        setAuthToken(config[provider].authToken);
        setAccountSID(config[provider].accountSID);
        setVerify(config[provider].verify.active);
        setServiceID(config[provider].verify.serviceSid);
      }
    },
    [provider]
  );

  useEffect(() => {
    prepareValues(config);
  }, [prepareValues, provider]);

  const onSaveClick = () => {
    // const data = {
    //   active: true,
    //   providerName: provider,
    //   [provider]: {
    //     verify: {
    //       active: verify,
    //       serviceSid: serviceID,
    //     },
    //     phoneNumber: number,
    //     accountSID: accountSID,
    //     authToken: authToken,
    //   },
    // };
  };

  const onCancelClick = () => {
    const selected = config.providerName;
    setProvider(selected);
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <Grid container style={{ padding: `16px 32px` }}>
          <Grid item xs={12}>
            <Typography variant={'h6'}>Provider Details</Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider className={classes.divider} />
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'h6'}>Provider</Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              className={classes.fieldSpace}
              select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              label=""
              helperText="Select your provider"
              variant="outlined">
              <MenuItem value={'twilio'}>Twilio</MenuItem>
              <MenuItem value={'twilio2'}>Twilio2</MenuItem>
            </TextField>
          </Grid>
          <Grid item style={{ marginTop: 32 }} xs={12}>
            <Typography variant={'h6'}>Provider Settings</Typography>
            <Divider className={classes.divider} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={classes.fieldSpace}
              required
              id="phone"
              label="Phone Number"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              value={accountSID}
              onChange={(e) => setAccountSID(e.target.value)}
              className={classes.fieldSpace}
              required
              id="sid"
              label="Account SID"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              className={classes.fieldSpace}
              required
              id="auth"
              label="Auth Token"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} style={{ marginTop: 32 }}>
            <Typography variant={'h6'}>Verify</Typography>
          </Grid>
          <Grid item className={classes.fieldSpace} container alignItems={'center'} xs={12}>
            <Typography variant={'body1'}>Verify:</Typography>
            <Switch
              size={'medium'}
              color={'primary'}
              checked={verify}
              onChange={() => setVerify(!verify)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              value={serviceID}
              onChange={(e) => setServiceID(e.target.value)}
              className={classes.fieldSpace}
              required
              id="sid"
              label="Service ID"
              variant="outlined"
            />
          </Grid>
          <Grid item container style={{ marginTop: 16 }} justify="flex-end" xs={12}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Clear />}
              style={{ marginRight: 16 }}
              onClick={onCancelClick}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={config.providerName === provider}
              startIcon={<Send />}
              onClick={onSaveClick}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default SmsProviderDetails;
