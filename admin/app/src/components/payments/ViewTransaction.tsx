import { Paper, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';

import React from 'react';
import { Transaction } from '../../models/payments/PaymentsModels';

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'center',
    justifySelf: 'center',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
    marginBottom: theme.spacing(3),
  },
  textField: {
    width: '100%',
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
  marginTop: {
    marginTop: '60px',
  },
  centeredImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface Props {
  transaction: Transaction;
}

const ViewTransaction: React.FC<Props> = ({ transaction }) => {
  const classes = useStyles();

  return (
    <Container className={classes.marginTop}>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2} justify="space-around">
            <Grid item xs={12}>
              <Typography variant="subtitle2">Transaction ID:</Typography>
              <Typography variant="h6">{transaction._id}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">User ID:</Typography>
              <Typography variant="h6">{transaction.userId}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Provider:</Typography>
              <Typography variant="h6">{transaction.provider}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Product:</Typography>
              <Typography variant="h6">{transaction.product}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Quantity:</Typography>
              <Typography variant="h6">{transaction.quantity}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Data:</Typography>
              <Typography variant="h6">{transaction.quantity}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Date:</Typography>
              <Typography variant="h6">{transaction.updatedAt}</Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Container>
  );
};

export default ViewTransaction;
