import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Clear, Send, Sms } from '@material-ui/icons';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(1, 1),
    color: theme.palette.text.secondary,
  },
}));

const SendSms: React.FC = () => {
  const classes = useStyles();

  const [number, setNumber] = useState<string>('');
  const [content, setContent] = useState<string>('');

  return (
    <Container>
      <Paper className={classes.paper} style={{ marginTop: 32 }}>
        <Grid container style={{ padding: `16px 32px` }}>
          <Grid item container alignItems={'center'} xs={12}>
            <Typography style={{ marginRight: 8 }} variant={'h6'}>
              Compose your SMS message
            </Typography>
            <Sms />
          </Grid>
          <Grid item style={{ marginTop: 16 }} xs={12}>
            <TextField
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              type={'text'}
              variant="outlined"
              label="Phone Number"
              placeholder={'ex. +3069xxxxxxxx'}
            />
          </Grid>
          <Grid item style={{ marginTop: 16 }} xs={12}>
            <TextField
              multiline
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={'4'}
              variant="outlined"
              label="sms content"
              fullWidth
              size={'medium'}
              placeholder={'Message'}
              type={'text'}
            />
          </Grid>
          <Grid item container style={{ marginTop: 16 }} justify="flex-end" xs={12}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Clear />}
              style={{ marginRight: 16 }}
              onClick={() => {
                setNumber('');
                setContent('');
              }}>
              Clear
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={!number || !content}
              startIcon={<Send />}>
              Send
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default SendSms;
