import React from 'react';
import { Button, Container, Grid, Theme, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { INewAdminUser } from '../../models/settings/SettingsModels';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { useDispatch } from 'react-redux';
import { asyncCreateAdminUser } from '../../redux/slices/settingsSlice';
import { FormProvider, useForm } from 'react-hook-form';

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    marginBottom: theme.spacing(2),
  },
  input: {
    marginBottom: theme.spacing(2),
    width: 300,
  },
  button: {
    marginTop: 16,
  },
  form: {
    maxWidth: 350,
  },
}));

const CreateNewUserTab: React.FC = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const methods = useForm<INewAdminUser>({ defaultValues: { username: '', password: '' } });

  const { reset } = methods;

  const handleRegister = (values: INewAdminUser) => {
    dispatch(asyncCreateAdminUser(values));
    reset();
  };

  return (
    <Container>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant={'h5'} className={classes.title}>
            Create New User
          </Typography>
        </Grid>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleRegister)} className={classes.form}>
            <FormInputText
              name="username"
              rules={{
                required: 'Username is required',
                minLength: { value: 5, message: 'Username should be 5 characters or longer' },
              }}
              label="Username"
            />
            <div style={{ marginTop: '10px' }}> </div>
            <FormInputText
              name="password"
              rules={{
                required: 'Password is required',
                minLength: { value: 5, message: 'Password should be 5 characters or longer' },
              }}
              label="Password"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.button}>
              Create New User
            </Button>
          </form>
        </FormProvider>
      </Grid>
    </Container>
  );
};

export default CreateNewUserTab;
