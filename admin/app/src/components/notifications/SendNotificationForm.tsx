import { Container, Typography, Paper, Grid, Button } from '@material-ui/core';
import React, { FC, useCallback, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { NotificationsOutlined, Send } from '@material-ui/icons';
import { FormProvider, useForm } from 'react-hook-form';
import { useAppSelector } from '../../redux/store';
import { useDispatch } from 'react-redux';
import { asyncGetAuthUserData } from '../../redux/slices/authenticationSlice';
import { AuthUser } from '../../models/authentication/AuthModels';
import TableDialog from '../common/TableDialog';
import SelectedElements from '../common/SelectedElements';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { NotificationData } from '../../models/notifications/NotificationModels';

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
  handleSend: (value: NotificationData) => void;
};

interface NotificationInputs {
  title: string;
  body: string;
}

const defaultValues = {
  title: '',
  body: '',
};

const SendNotificationForm: FC<SendNotificationProps> = ({ handleSend }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const methods = useForm<NotificationInputs>({ defaultValues: defaultValues });
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

  const onSubmit = (data: NotificationInputs) => {
    const dataToSend = { ...data, userIds: selectedUsers };
    handleSend(dataToSend);
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
        <FormProvider {...methods}>
          <form noValidate autoComplete="off" onSubmit={methods.handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <SelectedElements
                selectedElements={selectedUsers}
                handleButtonAction={() => setDrawer(true)}
                removeSelectedElement={removeSelectedUser}
                buttonText={'Add users'}
                header={'Selected users'}
              />
              <Grid item xs={12}>
                <FormInputText name="title" label="title" />
              </Grid>
              <Grid item xs={12}>
                <FormInputText name="body" rows={10} label="Body" />
              </Grid>
              <Grid item container justify="flex-end" xs={12}>
                <Button type="submit" variant="contained" color="primary" startIcon={<Send />}>
                  Send
                </Button>
              </Grid>
            </Grid>
          </form>
        </FormProvider>
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
