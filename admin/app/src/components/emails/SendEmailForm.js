import { Container } from '@material-ui/core';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Clear, MailOutline, Send } from '@material-ui/icons';
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

const SendEmailForm = ({ handleSend }) => {
  const classes = useStyles();

  const [emailState, setEmailState] = useState({ email: '', subject: '', body: '' });

  const sendEmail = () => {
    handleSend(emailState);
  };

  const clearEmail = () => {
    setEmailState({ email: '', subject: '', body: '' });
  };

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={5}>
        <Typography variant={'h6'} className={classes.typography}>
          <MailOutline fontSize={'small'} />. Compose your email
        </Typography>
        <form noValidate autoComplete="off">
          <Grid container>
            <Grid item xs={12}>
              <TextField
                required
                id="recipient"
                label="Recipient"
                variant="outlined"
                placeholder={'joedoe@gmail.com'}
                className={clsx(classes.textField, classes.simpleTextField)}
                value={emailState.email}
                onChange={(event) => {
                  setEmailState({
                    ...emailState,
                    email: event.target.value,
                  });
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                id="subject"
                label="Subject"
                variant="outlined"
                placeholder={'Hello World 👋'}
                className={clsx(classes.textField, classes.simpleTextField)}
                value={emailState.subject}
                onChange={(event) => {
                  setEmailState({
                    ...emailState,
                    subject: event.target.value,
                  });
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                id="outlined-multiline-static"
                label="Email body"
                multiline
                rows="10"
                variant="outlined"
                placeholder="Write your email here..."
                required
                fullWidth
                className={clsx(classes.textField)}
                value={emailState.body}
                onChange={(event) => {
                  setEmailState({
                    ...emailState,
                    body: event.target.value,
                  });
                }}
              />
            </Grid>
            <Grid item container justify="flex-end" xs={12}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Clear />}
                style={{ marginRight: 16 }}
                onClick={clearEmail}>
                Clear
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Send />}
                onClick={sendEmail}>
                Send
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default SendEmailForm;
