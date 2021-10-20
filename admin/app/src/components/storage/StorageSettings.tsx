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
import { IStorageConfig } from '../../models/storage/StorageModels';

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
  config: IStorageConfig;
  handleSave: (data: IStorageConfig) => void;
}

const initialSettingsState = {
  active: false,
  allowContainerCreation: true,
  defaultContainer: 'conduit',
  provider: 'azure',
  storagePath: '/var/tmp',
  google: { bucketName: '', serviceAccountKeyPath: '' },
  azure: { connectionString: '' },
};

const StorageSettings: React.FC<Props> = ({ config, handleSave, ...rest }) => {
  const classes = useStyles();
  const [settingsState, setSettingsState] = useState<IStorageConfig>(initialSettingsState);

  useEffect(() => {
    if (!config) {
      return;
    }

    setSettingsState(config);
  }, [config]);

  const handleSelect = (event: any) => {
    setSettingsState((prevState) => ({
      ...prevState,
      providerName: event.target.value,
    }));
  };

  const handleCancel = () => {
    if (config) {
      setSettingsState(config);
    } else {
      setSettingsState(initialSettingsState);
    }
  };

  const save = () => {
    handleSave({
      active: true,
      allowContainerCreation: true,
      azure: {
        connectionString:
          'DefaultEndpointsProtocol=https;AccountName=quintdevstorage;' +
          'AccountKey=wY/zoWSIeWP3dypqeWPGv/GiNJjyGhq8b6M454pU6eRC5I56Co5D2L00paT' +
          'GNjcqX8P4Np3S+SqmHK4gB2FB9A==;EndpointSuffix=core.windows.net',
      },
      defaultContainer: 'conduit',
      google: {
        serviceAccountKeyPath: '',
        bucketName: '',
      },
      provider: 'azure',
      storagePath: '/var/tmp',
    });
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
              value={'azure'}
              onChange={handleSelect}
              label="Provider">
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value={'azure'}>Azure</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            onChange={(event) => {
              setSettingsState({
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
          <Typography variant={'h6'}>The config for the Google storage provide</Typography>
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
              setSettingsState({
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
              setSettingsState({
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
              control={<Switch checked={true} value={'accountLinking'} color="primary" />}
              label={''}
            />
          </Box>
          <Divider className={classes.divider} />
          <Grid container spacing={2} className={classes.innerGrid}>
            {settingsState.active && renderSettingsFields()}
          </Grid>
          <Grid item container xs={12} justify={'flex-end'} style={{ marginTop: 16 }}>
            <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
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
