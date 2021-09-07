import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Container, FormControl, InputLabel, MenuItem, Select } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Divider from '@material-ui/core/Divider';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  innerGrid: {
    paddingLeft: theme.spacing(4),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  formControl: {
    minWidth: 250,
  },
}));

interface Props {
  config: any;
  handleSave: any;
}

const StorageSettings: React.FC<Props> = ({ config, handleSave, ...rest }) => {
  const classes = useStyles();
  const [settingsState, setSettingsSate] = useState({
    active: true,
    provider: 'local',
    storagePath: '/var/tmp',
    google: {
      serviceAccountKeyPath: '~/google_storage_service_account.json',
      bucketName: 'conduit',
    },
  });

  useEffect(() => {
    if (!config) {
      return;
    }

    setSettingsSate({
      ...settingsState,
      active: config.active,
      provider: config.provider,
      storagePath: config.storagePath,
      google: {
        serviceAccountKeyPath: config.google ? config.google.serviceAccountKeyPath : '',
        bucketName: config.google ? config.google.bucketName : '',
      },
    });
  }, [config, settingsState]);

  const handleSelect = (event) => {
    setSettingsSate({
      ...settingsState,
      providerName: event.target.value,
    });
  };

  const handleCancel = () => {
    if (config) {
      setSettingsSate({
        ...settingsState,
        active: config.active,
        provider: config.provider,
        storagePath: config.storagePath,
        google: {
          serviceAccountKeyPath: config.google.serviceAccountKeyPath,
          bucketName: config.google.bucketName,
        },
      });
    } else {
      setSettingsSate({
        active: true,
        provider: 'local',
        storagePath: '/var/tmp',
        google: {
          serviceAccountKeyPath: '~/google_storage_service_account.json',
          bucketName: 'conduit',
        },
      });
    }
  };
  const save = () => {
    const data = {
      active: settingsState.active,
      provider: settingsState.provider,
      storagePath: settingsState.storagePath,
      google: {
        serviceAccountKeyPath: settingsState.google.serviceAccountKeyPath,
        bucketName: settingsState.google.bucketName,
      },
    };
    handleSave(data);
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12} {...rest}>
          <Typography variant={'h6'}>The provider to use for storage</Typography>
        </Grid>
        <Grid item xs={6}>
          <FormControl variant="outlined" className={classes.formControl}>
            <InputLabel>Provider</InputLabel>
            <Select
              required
              labelId="provider-outlined-label"
              value={settingsState.provider}
              onChange={handleSelect}
              label="Provider">
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value={'local'}> Local </MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            onChange={(event) => {
              setSettingsSate({
                ...settingsState,
                storagePath: event.target.value,
              });
            }}
            value={settingsState.storagePath}
            variant="outlined"
            required
            fullWidth
            name="storagePath"
            label="Storage path"
            type="text"
            id="storagePath"
            autoComplete="storagePath"
          />
        </Grid>
        <Divider className={classes.divider} />
        <Grid item xs={12}>
          <Typography variant={'h6'}>
            The config for the Google storage provide
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            id="serviceAccountKeyPath"
            type="text"
            label="Account key path"
            variant="outlined"
            fullWidth
            value={settingsState.google.serviceAccountKeyPath}
            onChange={(event) => {
              setSettingsSate({
                ...settingsState,
                google: {
                  ...settingsState.google,
                  serviceAccountKeyPath: event.target.value,
                },
              });
            }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            id="bucketName"
            type="text"
            label="Bucket name"
            variant="outlined"
            fullWidth
            value={settingsState.google.bucketName}
            onChange={(event) => {
              setSettingsSate({
                ...settingsState,
                google: {
                  ...settingsState.google,
                  bucketName: event.target.value,
                },
              });
            }}
          />
        </Grid>
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
            <Typography variant={'h6'}>Activate Storage Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settingsState.active}
                  onChange={() =>
                    setSettingsSate({
                      ...settingsState,
                      active: !settingsState.active,
                    })
                  }
                  value={'accountLinking'}
                  color="primary"
                />
              }
              label={''}
            />
          </Box>
          <Divider className={classes.divider} />
          <Grid container spacing={2} className={classes.innerGrid}>
            {settingsState.active && renderSettingsFields()}
          </Grid>
          <Grid item container xs={12} justify={'flex-end'} style={{ marginTop: 16 }}>
            <Button
              onClick={() => handleCancel()}
              style={{ marginRight: 16 }}
              color={'primary'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              style={{ alignSelf: 'flex-end' }}
              onClick={() => save()}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default StorageSettings;
