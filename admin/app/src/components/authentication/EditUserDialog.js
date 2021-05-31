import React, { useState, useEffect } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogContent';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import EmailIcon from '@material-ui/icons/Email';
import Button from '@material-ui/core/Button';
import PhoneIcon from '@material-ui/icons/Phone';
import DoneOutlineIcon from '@material-ui/icons/DoneOutline';
import CloseIcon from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import { useDispatch } from 'react-redux';
import { editUserThunk } from '../../redux/thunks/authenticationThunks';
const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignItems: 'center',
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

export default function EditUserDialog({ data, open, handleClose }) {
  const dispatch = useDispatch();
  const classes = useStyles();
  const [values, setValues] = useState({
    // id: data._id || '',
    // email: data.Email || '',
    // active: data.Active || '',
    // verified: data.isVerified || '',
    // hasTwoFA: data.hasTwoFa || '',
  });

  useEffect(() => {
    setValues({ ...data });
  }, [data]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setValues({ ...values, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(editUserThunk(values));
    handleClose();
  };

  const handleCheckBoxChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.checked });
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle id="simple-dialog-title">
        Edit user
        <IconButton onClick={handleClose} className={classes.customizedButton}>
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
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item sm={12}>
                <TextField
                  fullWidth
                  variant="outlined"
                  id="phoneNumber"
                  name="phoneNumber"
                  label="Phone number"
                  onChange={handleInputChange}
                  value={values.phoneNumber}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item sm={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={values.active}
                      onChange={handleCheckBoxChange}
                      name="active"
                      color="secondary"
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid item sm={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={values.isVerified}
                      onChange={handleCheckBoxChange}
                      name="isVerified"
                      color="secondary"
                    />
                  }
                  label="Verified"
                />
              </Grid>
              <Grid item sm={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={values.hasTwoFA}
                      onChange={handleCheckBoxChange}
                      name="hasTwoFA"
                      color="secondary"
                    />
                  }
                  label="Has 2 factor authentication"
                />
              </Grid>
              <Grid item sm={12}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<DoneOutlineIcon />}>
                  Save
                </Button>
              </Grid>
            </Grid>
          </Container>
        </form>
      </DialogContent>
    </Dialog>
  );
}
