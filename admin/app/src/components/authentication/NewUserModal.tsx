import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import SaveIcon from '@material-ui/icons/Save';
import CloseIcon from '@material-ui/icons/Close';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import InputAdornment from '@material-ui/core/InputAdornment';
import AccountCircle from '@material-ui/icons/AccountCircle';
import DialogContent from '@material-ui/core/DialogContent';
import Fab from '@material-ui/core/Fab';
import Grid from '@material-ui/core/Grid';
import AddIcon from '@material-ui/icons/Add';
import Container from '@material-ui/core/Container';
import { IconButton, Typography } from '@material-ui/core';

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
}));

interface Props {
  handleNewUserDispatch: (values: { password: string; email: string }) => void;
}

const NewUserModal: React.FC<Props> = ({ handleNewUserDispatch }) => {
  const classes = useStyles();
  const [values, setValues] = useState<{ email: string; password: string }>({
    email: '',
    password: '',
  });
  const [emptyFieldsError, setEmptyFieldsError] = useState<boolean>(false);

  const [open, setOpen] = useState<boolean>(false);

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
    setOpen(false);
  };
  const handleInputChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    setValues({ ...values, [name]: value });
  };
  return (
    <div>
      <Fab
        color="secondary"
        aria-label="add"
        style={{
          margin: 0,
          top: 'auto',
          right: 20,
          bottom: 20,
          left: 'auto',
          position: 'fixed',
        }}
        onClick={() => setOpen(true)}>
        <AddIcon />
      </Fab>

      <Dialog onClose={() => setOpen(false)} aria-labelledby="simple-dialog-title" open={open}>
        <DialogTitle id="simple-dialog-title">
          Add a new user
          <IconButton onClick={() => setOpen(false)} className={classes.customizedButton}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewUserModal;
