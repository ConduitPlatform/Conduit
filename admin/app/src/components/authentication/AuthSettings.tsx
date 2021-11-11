import { Container, makeStyles } from '@material-ui/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { SettingsStateTypes, SignInMethods } from '../../models/authentication/AuthModels';
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
  handleSave: (data: SettingsStateTypes) => void;
  settingsData: SignInMethods;
}

interface IFormInput {
  active: boolean;
  radioValue: string;
  checkboxValue: string[];
  dateValue: Date;
  dropdownValue: string;
  sliderValue: number;
}

const AuthSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();
  const [edit, setEdit] = useState<boolean>(false);
  const methods = useForm<Props['settingsData']>({
    defaultValues: useMemo(() => {
      return settingsData;
    }, [settingsData]),
  });
  const { handleSubmit, reset, control } = methods;

  useEffect(() => {
    reset(settingsData);
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

  const onSubmit = (data: SignInMethods) => {
    setEdit(false);
    handleSave(data);
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit(onSubmit)} style={{}}>
          <Grid container>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'h6'}>Activate Authentication Module</Typography>
              <FormSwitch control={control} name={'active'} />
            </Box>
            <Divider className={classes.divider} />
            <Grid container spacing={2} className={classes.innerGrid}>
              {isActive && (
                <>
                  <Grid item xs={12}>
                    <Typography variant={'h6'}>
                      Limit the authentication tries/requests of clients
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <FormInputText name={'rateLimit'} control={control} label={'Rate limit'} />
                  </Grid>
                  <Grid item xs={6}>
                    <Box
                      width={'100%'}
                      display={'inline-flex'}
                      justifyContent={'space-between'}
                      alignItems={'center'}>
                      <Typography variant={'h6'}>Allow Refresh Token generation</Typography>
                      <FormSwitch name={'generateRefreshToken'} control={control} />
                    </Box>
                  </Grid>
                  <Grid item xs={6} />
                  <Box width={'100%'}>
                    <Divider className={classes.divider} />
                  </Box>
                  <Grid item xs={6}>
                    <Typography variant={'h6'}>Token expire period</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant={'h6'}>Refresh token expire period</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <FormInputText
                      name={'tokenInvalidationPeriod'}
                      label={'Token invalidation period'}
                      control={control}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormInputText
                      name={'refreshTokenInvalidationPeriod'}
                      label={'Refresh token invalidation period'}
                      control={control}
                    />
                  </Grid>
                  <Box width={'100%'}>
                    <Divider className={classes.divider} />
                  </Box>
                  <Grid item xs={6}>
                    <Typography variant={'h6'}>JWT Secret</Typography>
                  </Grid>
                  <Grid item xs={6} />
                  <Grid item xs={6}>
                    <FormInputText name={'jwtSecret'} label={'JWT secret'} control={control} />
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

export default AuthSettings;
