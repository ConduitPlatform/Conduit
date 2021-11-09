import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import SaveIcon from '@material-ui/icons/Save';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import InputAdornment from '@material-ui/core/InputAdornment';
import AccountCircle from '@material-ui/icons/AccountCircle';
import addUser from '../../assets/svgs/addUser.svg';
import Grid from '@material-ui/core/Grid';
import Image from 'next/image';
import Container from '@material-ui/core/Container';
import { useForm, Controller } from 'react-hook-form';

const useStyles = makeStyles(() => ({
  root: {
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'center',
    justifySelf: 'center',
  },
  textField: {
    textAlign: 'center',
  },
  customizedButton: {
    position: 'absolute',
    left: '92%',
    top: '1%',
    color: 'gray',
  },
  centeredImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface Props {
  handleNewUserDispatch: (values: { password: string; email: string }) => void;
}

const NewUserModal: React.FC<Props> = ({ handleNewUserDispatch }) => {
  const classes = useStyles();
  const { handleSubmit, control } = useForm();

  const onSubmit = (data: { password: string; email: string }) => {
    handleNewUserDispatch(data);
  };

  return (
    <div className={classes.root} style={{ marginTop: '150px' }}>
      <h3 style={{ textAlign: 'center' }}>Add a new user</h3>
      <form onSubmit={handleSubmit(onSubmit)} style={{}}>
        <Container className={classes.root} maxWidth="sm">
          <Grid container alignItems="center" className={classes.root} spacing={2}>
            <Grid item sm={12}>
              <Controller
                name="email"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextField
                    label="Email"
                    variant="outlined"
                    value={value}
                    fullWidth
                    onChange={onChange}
                    error={!!error}
                    helperText={error ? error.message : null}
                    type="email"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AccountCircle />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                rules={{ required: 'Email required' }}
              />
            </Grid>
            <Grid item sm={12}>
              <Controller
                name="password"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextField
                    label="Password"
                    variant="outlined"
                    value={value}
                    fullWidth
                    onChange={onChange}
                    error={!!error}
                    helperText={error ? error.message : null}
                    type="password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOpenIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                rules={{ required: 'Password required' }}
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                startIcon={<SaveIcon />}>
                Save
              </Button>
            </Grid>
          </Grid>
        </Container>
      </form>
      <div className={classes.centeredImg}>
        <Image src={addUser} width="200px" alt="addUser" />
      </div>
    </div>
  );
};

export default NewUserModal;
