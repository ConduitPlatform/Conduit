import { Container } from '@material-ui/core';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { NotificationsOutlined, Send } from '@material-ui/icons';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import clsx from 'clsx';

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

const SendNotificationForm = ({ handleSend }) => {
  const classes = useStyles();

  const [formState, setFormState] = useState({ title: '', body: '', data: '' });

  const handleTitleChange = (event) => {
    setFormState({ ...formState, title: event.target.value });
  };

  const handleBodyChange = (event) => {
    setFormState({ ...formState, body: event.target.value });
  };

  const handleDataChange = (event) => {
    setFormState({ ...formState, data: event.target.value });
  };

  const handleSendNotification = () => {
    handleSend();
  };

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={5}>
        <Typography variant={'h6'} className={classes.typography}>
          <NotificationsOutlined fontSize={'small'} /> Push notification
        </Typography>
        <form noValidate autoComplete="off" onSubmit={handleSendNotification}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                required
                label="Title"
                value={formState.title}
                onChange={handleTitleChange}
                variant="outlined"
                className={clsx(classes.textField, classes.simpleTextField)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Body"
                multiline
                rows="10"
                variant="outlined"
                placeholder="Write your email here..."
                required
                onChange={handleBodyChange}
                className={clsx(classes.textField, classes.simpleTextField)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Data"
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
