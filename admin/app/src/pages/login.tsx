import React, { useEffect } from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import { Formik } from 'formik';
import { asyncLogin } from '../redux/slices/appAuthSlice';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { useRouter } from 'next/router';
import Grid from '@material-ui/core/Grid';
import LoginIllustration from '../components/svgs/LoginIllustration';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    height: '100vh',
  },
  paper: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.palette.background.paper,
  },
  avatar: {
    backgroundColor: theme.palette.secondary.main,
  },
  title: {
    marginBottom: theme.spacing(4),
  },
  form: {
    width: '100%',
  },
  submit: {},
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
  illustrationContainer: {
    background: '#1F4068',
    padding: theme.spacing(4),
  },
}));

const Login: React.FC = () => {
  const { token } = useAppSelector((state) => state.appAuthSlice.data);
  const { loading } = useAppSelector((state) => state.appSlice);
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.replace('/');
    }
  }, [router, token]);

  const handleLogin = (values: { username: string; password: string; remember: boolean }) => {
    dispatch(asyncLogin(values));
  };

  const classes = useStyles();

  return (
    <Grid container className={classes.root}>
      <Grid container item xs={8} className={classes.illustrationContainer}>
        <LoginIllustration />
      </Grid>
      <Grid container item xs={4} className={classes.paper}>
        <Typography variant="h3" className={classes.title}>
          Conduit
        </Typography>
        <Typography variant="h5">Sign in</Typography>
        <Container maxWidth="xs">
          <Formik
            initialValues={{ username: '', password: '', remember: false }}
            onSubmit={(values, { setSubmitting, resetForm }) => {
              handleLogin(values);
              resetForm({
                values: { username: '', password: '', remember: false },
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
                    id="username"
                    label="Username"
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoFocus
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
                  <FormControlLabel
                    value={values.remember}
                    onChange={handleChange}
                    name={'remember'}
                    id={'remember'}
                    control={<Checkbox value="remember" color="primary" />}
                    label="Remember me"
                  />
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    className={classes.submit}
                    disabled={loading}>
                    Sign In
                  </Button>
                </form>
              );
            }}
          </Formik>
        </Container>
      </Grid>
    </Grid>
  );
};

export default Login;
