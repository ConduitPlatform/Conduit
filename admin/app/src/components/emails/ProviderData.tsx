import { Container } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Divider from '@material-ui/core/Divider';
import MenuItem from '@material-ui/core/MenuItem';
import { EmailSettings, TransportProviders } from '../../models/emails/EmailModels';
import TransportSettings from './TransportSettings';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
  innerGrid: {
    paddingLeft: theme.spacing(4),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  menuItem: {
    textTransform: 'capitalize',
  },
  muiSelect: {
    textTransform: 'capitalize',
  },
}));

const transportProviders = ['mailgun', 'smtp', 'mandrill', 'sendgrid'];

interface Props {
  settings: EmailSettings;
  handleSave: (data: EmailSettings) => void;
}

const ProviderData: React.FC<Props> = ({ settings, handleSave }) => {
  const classes = useStyles();
  const [settingsState, setSettingsState] = useState<EmailSettings>({
    active: false,
    sendingDomain: '',
    transport: 'smtp',
    transportSettings: {},
  });

  useEffect(() => {
    if (!settings) {
      return;
    }
    const data = {
      active: settings.active,
      transport: settings.transport,
      sendingDomain: settings.sendingDomain,
      transportSettings: settings.transportSettings,
    };
    setSettingsState(data);
  }, [settings]);

  const handleCancel = () => {
    setSettingsState({
      ...settingsState,
      active: settings.active,
      transport: settings.transport,
    });
  };

  const onSaveClick = () => {
    handleSave(settingsState);
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <Typography variant={'h6'}>Transport</Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            select
            label=""
            value={settingsState.transport}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                transport: event.target.value as TransportProviders,
              });
            }}
            className={classes.muiSelect}
            helperText="Select your transport provider"
            variant="outlined">
            {transportProviders.map((provider, index) => (
              <MenuItem value={provider} key={index} className={classes.menuItem}>
                {provider}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Sending Domain"
            value={settingsState.sendingDomain}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                sendingDomain: event.target.value,
              });
            }}
            variant="outlined"
          />
        </Grid>
        <Divider className={classes.divider} />
        <TransportSettings data={settingsState} />
      </>
    );
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <Grid container>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'h6'}>Email Settings Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settingsState.active}
                  onChange={() =>
                    setSettingsState({
                      ...settingsState,
                      active: !settingsState.active,
                    })
                  }
                  value={'active'}
                  color="primary"
                />
              }
              label={''}
            />
          </Box>

          <Divider className={classes.divider} />

          <Grid container spacing={2} className={classes.innerGrid}>
            {/*/!*{settingsState.active && renderSettingsFields()}*!/ todo revert before commit*/}
            {renderSettingsFields()}
          </Grid>
          <Grid item container xs={12} justify={'flex-end'}>
            <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              style={{ alignSelf: 'flex-end' }}
              onClick={() => onSaveClick()}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default ProviderData;
