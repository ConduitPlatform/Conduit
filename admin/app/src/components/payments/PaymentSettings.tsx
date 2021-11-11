import { Container } from '@material-ui/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { PaymentSettings as IPaymentSettings } from '../../models/payments/PaymentsModels';
import { FormSwitch } from '../common/RHFormComponents/RHFSwitch';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';

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
  settingsData: IPaymentSettings;
}

interface FormProps {
  active: boolean;
  enabled: boolean;
  secret_key: string;
}

const PaymentSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  const methods = useForm<FormProps>({
    defaultValues: useMemo(() => {
      return {
        active: settingsData.active,
        enabled: settingsData.stripe.enabled,
        secret_key: settingsData.stripe.secret_key,
      };
    }, [settingsData]),
  });
  const { handleSubmit, reset, control } = methods;

  useEffect(() => {
    reset({
      active: settingsData.active,
      enabled: settingsData.stripe.enabled,
      secret_key: settingsData.stripe.secret_key,
    });
  }, [reset, settingsData]);

  const isActive = useWatch({
    control,
    name: 'active',
  });

  const handleCancel = () => {
    reset();
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const onSubmit = (dataToSubmit: any) => {
    const data = {
      active: dataToSubmit.active,
      stripe: {
        enabled: dataToSubmit.enabled,
        secret_key: dataToSubmit.secret_key,
      },
    };

    setEdit(false);
    handleSave(data);
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'h6'}>Activate Payments Module</Typography>
              <FormSwitch name={'active'} control={control} disabled={!edit} />
            </Box>

            <Divider className={classes.divider} />

            <Grid container spacing={2} className={classes.innerGrid}>
              {isActive && (
                <>
                  <Grid item xs={6}>
                    <Box
                      width={'100%'}
                      display={'inline-flex'}
                      justifyContent={'space-between'}
                      alignItems={'center'}>
                      <Typography variant={'h6'}>Enable stripe payments</Typography>
                      <FormSwitch name={'enabled'} control={control} disabled={!edit} />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant={'h6'}>Stripe secret key</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <FormInputText
                      name={'secret_key'}
                      label={'Secret key'}
                      control={control}
                      disabled={!edit}
                    />
                  </Grid>
                </>
              )}
            </Grid>
            {edit && (
              <Grid item container xs={12} justify={'flex-end'}>
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
                  type="submit">
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
        </form>
      </Paper>
    </Container>
  );
};

export default PaymentSettings;
