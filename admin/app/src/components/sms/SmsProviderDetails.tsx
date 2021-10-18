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
import { useAppSelector } from '../../redux/store';
import { ChildConfigKey, ConfigKey, ISmsConfig, ISmsProviders } from '../../models/sms/SmsModels';
import SmsProviderDetailsFields from './SmsProviderDetailsFields';

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

const providers: 'twilio'[] = ['twilio'];

const SmsProviderDetails: React.FC = () => {
  const classes = useStyles();

  const { config } = useAppSelector((state) => state.smsSlice.data);

  const [configState, setConfigState] = useState<ISmsConfig>({
    active: false,
    providerName: ISmsProviders.twilio,
    twilio: {
      phoneNumber: '',
      accountSID: '',
      authToken: '',
      verify: {
        active: false,
        serviceSid: '',
      },
    },
  });

  useEffect(() => {
    if (!config) {
      return;
    }
    setConfigState(config);
  }, [config]);

  const handleCancel = () => {
    setConfigState({
      ...configState,
      active: config.active,
      providerName: config.providerName,
    });
  };

  const onChange = (value: string | boolean, key: ConfigKey, childKey?: ChildConfigKey) => {
    const innerConfigState = configState[configState.providerName];
    if (childKey) {
      const newConfig = {
        ...configState,
        [configState.providerName]: {
          ...innerConfigState,
          verify: {
            ...innerConfigState.verify,
            [childKey]: value,
          },
        },
      };
      setConfigState(newConfig);
      return;
    }
    const configNew = {
      ...configState,
      [configState.providerName]: {
        ...innerConfigState,
        [key]: value,
      },
    };
    setConfigState(configNew);
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <Typography variant={'h6'}>Provider</Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            select
            label=""
            value={configState.providerName}
            onChange={(event) => {
              setConfigState({
                ...configState,
                providerName: event.target.value as ISmsProviders,
              });
            }}
            className={classes.muiSelect}
            helperText="Select your provider"
            variant="outlined">
            {providers.map((provider, index) => (
              <MenuItem value={provider} key={index} className={classes.menuItem}>
                {provider}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Divider className={classes.divider} />
        <SmsProviderDetailsFields
          data={configState[configState.providerName]}
          onChange={onChange}
        />
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
            <Typography variant={'h6'}>Sms Settings Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={configState.active}
                  onChange={() =>
                    setConfigState({
                      ...configState,
                      active: !configState.active,
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
            {configState.active && renderSettingsFields()}
          </Grid>
          <Grid item container xs={12} justify={'flex-end'}>
            <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              style={{ alignSelf: 'flex-end' }}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default SmsProviderDetails;
