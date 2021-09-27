import React, { useEffect } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import { Formik } from 'formik';
import { LockOutlined } from '@material-ui/icons';
import { asyncLogin } from '../redux/slices/appAuthSlice';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { useRouter } from 'next/router';

const useStyles = makeStyles((theme: Theme) => ({
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
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Login: React.FC = () => {
  const { token } = useAppSelector((state) => state.appAuthSlice.data);
  const { loading } = useAppSelector((state) => state.appSlice.loading);
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.replace('/');
    }
  }, [router, token]);

  const handleLogin = (values: {
    username: string;
    password: string;
    remember: boolean;
  }) => {
    dispatch(asyncLogin(values));
  };

  const classes = useStyles();

  return (
    <Container maxWidth="xs">
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlined />
        </Avatar>
        <Typography variant="h5">Sign in</Typography>
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
      </div>
    </Container>
  );
};

export default Login;
