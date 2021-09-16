import React from 'react';
import { Button, Container, Grid, TextField, Theme, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { INewAdminUser } from '../../models/settings/SettingsModels';
import { Formik } from 'formik';
import { useDispatch } from 'react-redux';
import { createNewAdminUser } from '../../redux/thunks/settingsThunks';

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

  const handleRegister = (values: INewAdminUser) => {
    dispatch(createNewAdminUser(values));
  };

  return (
    <Container>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant={'h5'} className={classes.title}>
            Create New User
          </Typography>
        </Grid>
        <Formik
          initialValues={{ username: '', password: '' }}
          onSubmit={(values, { setSubmitting, resetForm }) => {
            handleRegister(values);
            resetForm({
              values: { username: '', password: '' },
            });
            setSubmitting(false);
          }}>
          {({ handleSubmit, handleChange, values }) => {
            return (
              <form onSubmit={handleSubmit} className={classes.form}>
                <TextField
                  onChange={handleChange}
                  value={values.username}
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  name="username"
                  label="Username"
                />
                <TextField
                  onChange={handleChange}
                  value={values.password}
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
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
            );
          }}
        </Formik>
      </Grid>
    </Container>
  );
};

export default CreateNewUserTab;
