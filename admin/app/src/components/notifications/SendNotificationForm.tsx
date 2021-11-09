import { Container, Typography, Paper, Grid, Button, TextField } from '@material-ui/core';
import React, { FC, useCallback, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { NotificationsOutlined, Send } from '@material-ui/icons';
import { useAppSelector } from '../../redux/store';
import { useDispatch } from 'react-redux';
import { asyncGetAuthUserData } from '../../redux/slices/authenticationSlice';
import { AuthUser } from '../../models/authentication/AuthModels';
import TableDialog from '../common/TableDialog';
import { useForm, Controller } from 'react-hook-form';
import SelectedElements from '../common/SelectedElements';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
  chip: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
  center: {
    textAlign: 'center',
  },
}));

type SendNotificationProps = {
  handleSend: (value: any) => void;
};

const SendNotificationForm: FC<SendNotificationProps> = ({ handleSend }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const { handleSubmit, control, reset } = useForm();

  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { users, count } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const getData = useCallback(
    (params: { skip: number; limit: number; search: string; filter: string }) => {
      dispatch(asyncGetAuthUserData(params));
    },
    [dispatch]
  );

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Email', sort: 'email' },
    { title: 'Active', sort: 'active' },
    { title: 'Verified', sort: 'isVerified' },
    { title: 'Registered At', sort: 'createdAt' },
  ];
  const formatData = (usersToFormat: AuthUser[]) => {
    return usersToFormat.map((u) => {
      return {
        _id: u._id,
        Email: u.email ? u.email : 'N/A',
        Active: u.active,
        Verified: u.isVerified,
        'Registered At': u.createdAt,
      };
    });
  };

  const onSubmit = (data: { title: string; body: string }) => {
    console.log({ ...data, userIds: selectedUsers });

    handleSend({ ...data, userIds: selectedUsers });
    reset();
  };

  const removeSelectedUser = (i: number) => {
    const filteredArray = selectedUsers.filter((user, index) => index !== i);
    setSelectedUsers(filteredArray);
  };

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={5}>
        <Typography variant={'h6'} className={classes.typography}>
          <NotificationsOutlined fontSize={'small'} style={{ marginBottom: '-2px' }} /> Push
          notification
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)} style={{}}>
          <Grid container alignItems="center" spacing={2}>
            <SelectedElements
              selectedElements={selectedUsers}
              handleButtonAction={() => setDrawer(true)}
              removeSelectedElement={removeSelectedUser}
              buttonText={'Add users'}
              header={'Selected users'}
            />
            <Grid item sm={12}>
              <Controller
                name="title"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextField
                    required
                    fullWidth
                    label="Title"
                    value={value}
                    onChange={onChange}
                    variant="outlined"
                  />
                )}
                rules={{ required: 'Email required' }}
              />
            </Grid>
            <Grid item sm={12}>
              <Controller
                name="body"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextField
                    label="Body"
                    multiline
                    fullWidth
                    error={!!error}
                    value={value}
                    rows="10"
                    variant="outlined"
                    placeholder="Write your message here..."
                    required
                    onChange={onChange}
                  />
                )}
                rules={{ required: 'Password required' }}
              />
            </Grid>
            <Grid item container justify="flex-end" xs={12}>
              <Button variant="contained" color="primary" startIcon={<Send />} type="submit">
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
        buttonText={'Select users'}
        setExternalElements={setSelectedUsers}
        externalElements={selectedUsers}
      />
    </Container>
  );
};

export default SendNotificationForm;
