import { Container, MenuItem } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { PaymentSettings as IPaymentSettings } from '../../models/payments/PaymentsModels';

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
}));

interface Props {
  handleSave: (data: IPaymentSettings) => void;
  settingsData: IPaymentSettings | null;
}

const PaymentSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  const [settingsState, setSettingsState] = useState<IPaymentSettings>({
    active: false,
    providerName: 'stripe',
    stripe: {
      enabled: false,
      secret_key: '',
    },
  });
  const [openSaveDialog, setOpenSaveDialog] = useState<boolean>(false);
  const [provider, setProvider] = useState<string>(settingsState.providerName);

  useEffect(() => {
    if (!settingsData) {
      return;
    }
    setSettingsState({
      active: settingsData.active,
      providerName: 'stripe',
      stripe: {
        enabled: settingsData.stripe.enabled,
        secret_key: settingsData.stripe.secret_key,
      },
    });
  }, [settingsData]);

  const handleCancel = () => {
    if (!settingsData) {
      return;
    }
    setEdit(false);
    setSettingsState({
      active: settingsData.active,
      providerName: 'stripe',
      stripe: {
        enabled: settingsData.stripe.enabled,
        secret_key: settingsData.stripe.secret_key,
      },
    });
  };

  const providers = [
    {
      value: 'stripe',
      label: 'Stripe',
    },
  ];

  const handleProviderChange = (event: React.ChangeEvent<{ value: string }>) => {
    setProvider(event.target.value);
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const save = () => {
    const data = {
      active: settingsState.active,
      providerName: 'stripe',
      stripe: {
        enabled: settingsState.stripe.enabled,
        secret_key: settingsState.stripe.secret_key,
      },
    };
    setEdit(false);
    handleSave(data);
    setOpenSaveDialog(false);
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <TextField
            disabled={!edit}
            id="outlined-select-provider"
            select
            label="Provider"
            value={provider}
            onChange={handleProviderChange}
            variant="outlined">
            {providers.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {settingsState.providerName === 'stripe' && (
          <>
            <Grid item xs={6}>
              <Box
                width={'100%'}
                display={'inline-flex'}
                justifyContent={'space-between'}
                alignItems={'center'}>
                <Typography variant={'h6'}>Enable stripe payments</Typography>
                <FormControlLabel
                  label={''}
                  control={
                    <Switch
                      disabled={!edit}
                      checked={settingsState.stripe.enabled}
                      onChange={() => {
                        setSettingsState({
                          ...settingsState,
                          stripe: {
                            ...settingsState.stripe,
                            enabled: !settingsState.stripe.enabled,
                          },
                        });
                      }}
                      value={'accountLinking'}
                      color="primary"
                    />
                  }
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant={'h6'}>Stripe secret key</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                disabled={!edit}
                id="outlined-number"
                label="Secret key"
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
                onChange={(event) => {
                  setSettingsState({
                    ...settingsState,
                    stripe: { ...settingsState.stripe, secret_key: event.target.value },
                  });
                }}
                value={settingsState.stripe.secret_key}
              />
            </Grid>
          </>
        )}
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
            <Typography variant={'h6'}>Activate Payments Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  disabled={!edit}
                  checked={settingsState.active}
                  onChange={() =>
                    setSettingsState({
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
          {edit && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => setOpenSaveDialog(true)}>
                Save
              </Button>
            </Grid>
          )}
          {!edit && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button
                onClick={() => handleEditClick()}
                style={{ marginRight: 16 }}
                color={'primary'}>
                Edit
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>
      <ConfirmationDialog
        open={openSaveDialog}
        handleClose={() => setOpenSaveDialog(false)}
        title={'Are you sure you want to proceed?'}
        description={'Payment settings changed'}
        buttonAction={save}
        buttonText={'Proceed'}
      />
    </Container>
  );
};

export default PaymentSettings;
