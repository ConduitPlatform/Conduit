import { Container, FormControl, InputLabel, MenuItem, Select } from '@material-ui/core';
import React, { FC, useCallback, useEffect, useState } from 'react';
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
import TableDialog from '../common/TableDialog';

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
  const [drawer, setDrawer] = useState<boolean>(false);

  const { users, count } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const getData = useCallback(
    (params: { skip: number; limit: number; search: string; filter: string }) => {
      dispatch(asyncGetAuthUserData(params));
    },
    [dispatch]
  );

  useEffect(() => {
    if (drawer) {
      getData;
    }
  }, [getData, drawer]);

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Email', sort: 'email' },
    { title: 'Active', sort: 'active' },
    { title: 'Verified', sort: 'isVerified' },
    { title: 'Registered At', sort: 'createdAt' },
  ];
  const formatData = (users: AuthUser[]) => {
    return users.map((u) => {
      return {
        _id: u._id,
        Email: u.email ? u.email : 'N/A',
        Active: u.active,
        Verified: u.isVerified,
        'Registered At': u.createdAt,
      };
    });
  };

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
              <Button onClick={() => setDrawer(true)}>Add users</Button>
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
      <TableDialog
        open={drawer}
        title={'Select users'}
        headers={headers}
        getData={getData}
        data={{ tableData: formatData(users), count: count }}
        handleClose={() => setDrawer(false)}
      />
    </Container>
  );
};

export default SendNotificationForm;
