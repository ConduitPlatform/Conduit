import React, { useEffect, useState } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import { Formik } from 'formik';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { Layout } from '../components/Layout';
import { LockOutlined } from '@material-ui/icons';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../redux/thunks/appAuthThunks';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Router from 'next/router';

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
  },
  form: {
    width: '100%',
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Login = () => {
  const authState = useSelector((state) => state.appAuthReducer);
  const dispatch = useDispatch();
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    if (authState.error) {
      setSnackbarOpen(true);
    }
  }, [authState.error]);

  useEffect(() => {
    if (authState.token) {
      Router.replace('/');
    }
  }, [authState.token]);

  const handleLogin = (values) => {
    dispatch(login(values.username, values.password, values.remember));
  };

  const snackbarAlert = () => {
    if (authState.error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {authState?.error?.data?.error
            ? authState.error.data.error
            : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const classes = useStyles();

  return (
    <Layout menuDisabled>
      <Container maxWidth="xs">
        <div className={classes.paper}>
          <Avatar className={classes.avatar}>
            <LockOutlined />
          </Avatar>
          <Typography variant="h5">Sign in</Typography>
          <Formik
            style={{ width: '100%' }}
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
                    disabled={authState.loading}>
                    Sign In
                  </Button>
                </form>
              );
            }}
          </Formik>
          <Snackbar
            open={snackbarOpen}
            className={classes.snackBar}
            autoHideDuration={6000}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            {snackbarAlert()}
          </Snackbar>
          <Backdrop open={authState.loading} className={classes.backdrop}>
            <CircularProgress color="secondary" />
          </Backdrop>
        </div>
      </Container>
    </Layout>
  );
};

export default Login;
