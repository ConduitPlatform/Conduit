import React, { useEffect, useState } from 'react';
import { Chip, Paper, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Image from 'next/dist/client/image';
import SubsriptionImage from '../../assets/svgs/subscriptions.svg';
import { Subscription, Transaction } from '../../models/payments/PaymentsModels';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetTransactions } from '../../redux/slices/paymentsSlice';
import DataTable from '../common/DataTable';
import Paginator from '../common/Paginator';
import sharedClasses from '../common/sharedClasses';

interface Props {
  subscription: Subscription;
}

const ViewSubscription: React.FC<Props> = ({ subscription }) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);

  const { transactions } = useAppSelector((state) => state.paymentsSlice.data.transactionData);

  useEffect(() => {
    if (subscription.customerId && subscription.product) {
      dispatch(
        asyncGetTransactions({
          skip: 0,
          limit: 10,
          productId: subscription.product,
          customerId: subscription.customerId,
        })
      );
    }
  }, [dispatch, subscription.customerId, subscription.product]);

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
  };

  const formatData = (data: Transaction[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        provider: u.provider,
        product: u.product,
        quantity: u.quantity,
        'Updated At': u.updatedAt,
      };
    });
  };

  const chipsToDisplay = (values: Subscription) => {
    return Object.entries(values).map(
      ([key, value]) =>
        key !== 'transactions' && <Chip color="secondary" label={`${key}: ${value}`} />
    );
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Provider', sort: 'provider' },
    { title: 'Product', sort: 'product' },
    { title: 'Quantity', sort: 'quantity' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  return (
    <Container>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Typography style={{ marginBottom: '25px' }}>Transactions: </Typography>
          <Grid container spacing={2} justify="space-around">
            {transactions.length ? (
              <>
                <DataTable dsData={formatData(transactions)} headers={headers} />
                <Paginator
                  handlePageChange={handlePageChange}
                  limit={limit}
                  handleLimitChange={handleLimitChange}
                  page={page}
                  count={transactions.length}
                />
              </>
            ) : (
              <Typography style={{ textAlign: 'center' }}>No available transactions </Typography>
            )}
          </Grid>
          <Grid container spacing={2} justify="space-around" className={classes.chip}>
            {chipsToDisplay(subscription)}
          </Grid>
        </Paper>
        <div className={classes.centeredImg}>
          <Image src={SubsriptionImage} width="200px" alt="transaction" />
        </div>
      </Box>
    </Container>
  );
};

export default ViewSubscription;
