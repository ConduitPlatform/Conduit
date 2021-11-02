import React from 'react';
import { Chip, Paper, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Image from 'next/dist/client/image';
import TransactionImage from '../../assets/svgs/transaction.svg';
import { Transaction } from '../../models/payments/PaymentsModels';
import sharedClasses from './sharedClasses';

interface Props {
  transaction: Transaction;
}

const ViewTransaction: React.FC<Props> = ({ transaction }) => {
  const classes = sharedClasses();

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
              {Object.entries(transaction.data).map(([key, value], index: number) => (
                <Chip size="small" label={`${key}: ${value}`} key={index} />
              ))}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Date:</Typography>
              <Typography variant="h6">{transaction.updatedAt}</Typography>
            </Grid>
          </Grid>
        </Paper>
        <div className={classes.centeredImg}>
          <Image src={TransactionImage} width="200px" alt="transaction" />
        </div>
      </Box>
    </Container>
  );
};

export default ViewTransaction;
