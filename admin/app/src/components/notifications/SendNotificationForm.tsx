import { Container, FormControl, InputLabel, MenuItem, Select } from '@material-ui/core';
import React, { FC, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { NotificationsOutlined, Send } from '@material-ui/icons';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';

import { NotificationData } from '../../models/notifications/NotificationModels';
import { useAppSelector } from '../../redux/store';
import { useDispatch } from 'react-redux';
import { asyncGetAuthUserData } from '../../redux/slices/authenticationSlice';
import { AuthUser } from '../../models/authentication/AuthModels';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
}));

type SendNotificationProps = {
  handleSend: (value: any) => void;
};

const SendNotificationForm: FC<SendNotificationProps> = ({ handleSend }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [select, setSelect] = useState<string | number>(-1);

  const { users } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  useEffect(() => {
    dispatch(asyncGetAuthUserData({ skip: 0, limit: 100, search: '', filter: 'all' }));
  }, [dispatch]);

  const [formState, setFormState] = useState<NotificationData>({
    title: '',
    body: '',
    userId: '',
  });

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  const handleSendNotification = () => {
    handleSend(formState);
  };

  const handleUserChange = (e: React.ChangeEvent<any>) => {
    setSelect(e.target.value);

    const foundUser = users.find((user: AuthUser) => user._id === e.target.value);

    if (e.target.value !== '' && foundUser !== undefined)
      setFormState({ ...formState, userId: foundUser._id });
    else setFormState({ ...formState, userId: '' });
  };

  const extractLabel = () => {
    if (select === -1) {
      return 'Select user';
    } else return 'Selected user';
  };

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={5}>
        <Typography variant={'h6'} className={classes.typography}>
          <NotificationsOutlined fontSize={'small'} style={{ marginBottom: '-2px' }} /> Push
          notification
        </Typography>
        <form noValidate autoComplete="off" onSubmit={handleSendNotification}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl variant="outlined" fullWidth>
                <InputLabel>{extractLabel()}</InputLabel>
                <Select label="Select user" value={select} onChange={handleUserChange}>
                  <MenuItem value={-1}>
                    <em>None</em>
                  </MenuItem>
                  {users.length > 0 &&
                    users.map((user, index: number) => (
                      <MenuItem key={index} value={user._id}>
                        {user.email}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Title"
                name="title"
                value={formState.title}
                onChange={handleDataChange}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Body"
                name="body"
                multiline
                fullWidth
                rows="10"
                variant="outlined"
                placeholder="Write your message here..."
                required
                onChange={handleDataChange}
              />
            </Grid>
            <Grid item container justify="flex-end" xs={12}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Send />}
                onClick={handleSendNotification}>
                Send
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default SendNotificationForm;
