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
import { FormSwitch } from '../common/FormComponents/FormSwitch';
import { FormInput } from '../common/FormComponents/FormInput';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  innerGrid: {
    padding: theme.spacing(3),
  },
}));

interface Props {
  handleSave: (data: SettingsStateTypes) => void;
  settingsData: SignInMethods;
}

const AuthSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();
  const [edit, setEdit] = useState<boolean>(false);
  const methods = useForm<SignInMethods>({
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
    setEdit(!edit);
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
    <Container maxWidth="md">
      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit(onSubmit)} style={{}}>
          <Container maxWidth="md">
            <Grid container spacing={3}>
              <Box
                width={'100%'}
                display={'inline-flex'}
                justifyContent={'space-between'}
                alignItems={'center'}>
                <Typography variant={'h6'}>Activate Authentication Module</Typography>
                <FormSwitch control={control} name={'active'} disabled={!edit} />
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
                    <Grid item xs={6}>
                      <FormInput
                        name={'rateLimit'}
                        control={control}
                        label={'Rate limit'}
                        disabled={!edit}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Box
                        width={'100%'}
                        display={'inline-flex'}
                        justifyContent={'space-between'}
                        alignItems={'center'}>
                        <Typography variant={'h6'}>Allow Refresh Token generation</Typography>
                        <FormSwitch
                          name={'generateRefreshToken'}
                          control={control}
                          disabled={!edit}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6} />
                    <Box width={'100%'}>
                      <Divider className={classes.divider} />
                    </Box>
                    <Grid item xs={6}>
                      <Typography variant={'h6'}>Token expiration period</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant={'h6'}>Refresh token expiration period</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <FormInput
                        name={'tokenInvalidationPeriod'}
                        label={'Token invalidation period'}
                        control={control}
                        disabled={!edit}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormInput
                        name={'refreshTokenInvalidationPeriod'}
                        label={'Refresh token invalidation period'}
                        control={control}
                        disabled={!edit}
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
                      <FormInput
                        name={'jwtSecret'}
                        label={'JWT secret'}
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
          </Container>
        </form>
      </Paper>
    </Container>
  );
};

export default AuthSettings;
