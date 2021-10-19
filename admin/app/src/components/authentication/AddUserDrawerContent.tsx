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
import { Typography } from '@material-ui/core';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import { useAppDispatch } from '../../redux/store';

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
  const dispatch = useAppDispatch();
  const [values, setValues] = useState<{ email: string; password: string }>({
    email: '',
    password: '',
  });
  const [emptyFieldsError, setEmptyFieldsError] = useState<boolean>(false);

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const hasEmptyFields = Object.values(values).some((element) => element === '');

    if (hasEmptyFields) {
      setEmptyFieldsError(true);
      return;
    }
    setEmptyFieldsError(false);
    handleNewUserDispatch(values);
    setValues({ email: '', password: '' });
  };
  const handleInputChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    if (value.includes(' ')) {
      dispatch(enqueueInfoNotification(`The ${name} cannot contain spaces`));
    }

    setValues({ ...values, [name]: value.replace(/\s/g, '') });
  };
  return (
    <div className={classes.root} style={{ marginTop: '150px' }}>
      <h3 style={{ textAlign: 'center' }}>Add a new user</h3>
      <form onSubmit={handleSubmit} style={{}}>
        <Container className={classes.root} maxWidth="sm">
          <Grid container alignItems="center" className={classes.root} spacing={2}>
            <Grid item sm={12}>
              <TextField
                fullWidth
                className={classes.textField}
                variant="outlined"
                id="email"
                name="email"
                label="Username/Email"
                onChange={handleInputChange}
                value={values.email}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircle />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item sm={12}>
              <TextField
                fullWidth
                variant="outlined"
                id="password"
                name="password"
                label="Password"
                onChange={handleInputChange}
                value={values.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOpenIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {emptyFieldsError && (
              <Grid item sm={12}>
                <Typography color="error">Please fill the fields</Typography>
              </Grid>
            )}
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
