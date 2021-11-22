import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Container, MenuItem } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { IStorageConfig } from '../../models/storage/StorageModels';
import StorageProviderSettings from './StorageProviderSettings';
import TextField from '@material-ui/core/TextField';
import { FormProvider } from 'react-hook-form';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';

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

const StorageSettings: React.FC<Props> = ({ config, handleSave }) => {
  const classes = useStyles();
  const initialSettingsState = {
    active: false,
    allowContainerCreation: true,
    defaultContainer: 'conduit',
    provider: 'azure',
    storagePath: '/var/tmp',
    google: { bucketName: '', serviceAccountKeyPath: '' },
    azure: { connectionString: '' },
  };
  const [settingsState, setSettingsState] = useState<IStorageConfig>(initialSettingsState);

  useEffect(() => {
    if (!config) {
      return;
    }
    setSettingsState(config);
  }, [config]);

  const handleCancel = () => {
    if (config) {
      setSettingsState(config);
    } else {
      setSettingsState(initialSettingsState);
    }
  };

  const save = () => {
    handleSave(settingsState);
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <Grid container>
              <Box
                width={'100%'}
                display={'inline-flex'}
                justifyContent={'space-between'}
                alignItems={'center'}>
                <Typography variant={'h6'}>Activate Storage Module</Typography>
                <FormInputSwitch name={'active'} disabled={!edit} />
              </Box>
              <Divider className={classes.divider} />
              <Grid container spacing={2} className={classes.innerGrid}>
                {settingsState.active && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant={'h6'}>The provider to use for storage</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label=""
                        value={settingsState.provider}
                        onChange={(event) => {
                          setSettingsState({
                            ...settingsState,
                            provider: event.target.value,
                          });
                        }}
                        helperText="Select your storage provider"
                        variant="outlined">
                        <MenuItem value="azure">Azure</MenuItem>
                        <MenuItem value="google">Google</MenuItem>
                      </TextField>
                    </Grid>
                    <Divider className={classes.divider} />
                    <StorageProviderSettings data={settingsState} onChange={setSettingsState} />
                  </>
                )}
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
          </form>
        </FormProvider>
      </Paper>
    </Container>
  );
};

export default StorageSettings;
