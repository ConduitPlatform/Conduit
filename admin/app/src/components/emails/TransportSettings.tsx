import React from 'react';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EmailSettings } from '../../models/emails/EmailModels';

const useStyles = makeStyles((theme) => ({
  input: {
    marginBottom: theme.spacing(2),
  },
}));

const transportProviderFields = {
  mailgun: [
    { label: 'API Key', value: 'apiKey' },
    { label: 'Domain', value: 'domain' },
    { label: 'Host', value: 'host' },
  ],
  smtp: [
    { label: 'Port', value: 'port' },
    { label: 'Host', value: 'host' },
  ],
  mandrill: [{ label: 'API Key', value: 'apiKey' }],
  sendgrid: [{ label: 'API User', value: 'apiUser' }],
};

const transportProviderExtraFields = {
  smtp: {
    auth: [
      { label: 'Username', value: 'username' },
      { label: 'Password', value: 'password' },
      { label: 'Method', value: 'method' },
    ],
  },
};

interface Props {
  data: EmailSettings;
}

const TransportSettings: React.FC<Props> = ({ data }) => {
  const classes = useStyles();
  const handleFields = () => {
    if (!data.transport) {
      return <>N/A</>;
    }
    return (
      <Grid item container xs={12} direction="column">
        {transportProviderFields[data.transport].map((item, index: number) => {
          return (
            <Box key={index}>
              <TextField
                required
                id={item.value}
                label={item.label}
                variant="outlined"
                className={classes.input}
                // value={settingsState.transportSettings.apiKey}
                // onChange={(event) => {
                //   setSettingsState({
                //     ...settingsState,
                //     transportSettings: {
                //       ...settingsState.transportSettings,
                //       apiKey: event.target.value,
                //     },
                //   });
                // }}
              />
            </Box>
          );
        })}
        {transportProvider === 'smtp' && (
          <>
            <Typography className={classes.input}>Authentication</Typography>
            {transportProviderExtraFields['smtp'].auth.map((item, index) => {
              return (
                <Box key={index}>
                  <TextField
                    required
                    id={item.value}
                    label={item.label}
                    variant="outlined"
                    className={classes.input}
                    // value={settingsState.transportSettings.apiKey}
                    // onChange={(event) => {
                    //   setSettingsState({
                    //     ...settingsState,
                    //     transportSettings: {
                    //       ...settingsState.transportSettings,
                    //       apiKey: event.target.value,
                    //     },
                    //   });
                    // }}
                  />
                </Box>
              );
            })}
          </>
        )}
      </Grid>
    );
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant={'h6'}>Transport settings</Typography>
      </Grid>
      {handleFields()}
    </>
  );
};

export default TransportSettings;
