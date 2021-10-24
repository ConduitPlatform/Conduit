import { Container } from '@material-ui/core';
import React, { FC, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { NotificationsOutlined, Send } from '@material-ui/icons';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import clsx from 'clsx';
import { NotificationData } from '../../models/notifications/NotificationModels';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
  simpleTextField: {
    width: '65ch',
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

  const [formState, setFormState] = useState<NotificationData>({
    title: '',
    body: '',
    data: '',
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
              <TextField
                required
                label="Title"
                name="title"
                value={formState.title}
                onChange={handleDataChange}
                variant="outlined"
                className={clsx(classes.textField, classes.simpleTextField)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Body"
                name="body"
                multiline
                rows="10"
                variant="outlined"
                placeholder="Write your email here..."
                required
                onChange={handleDataChange}
                className={clsx(classes.textField, classes.simpleTextField)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Data"
                name="data"
                multiline
                rows="10"
                variant="outlined"
                placeholder="Write your email here..."
                required
                value={formState.data}
                onChange={handleDataChange}
                className={clsx(classes.textField, classes.simpleTextField)}
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
