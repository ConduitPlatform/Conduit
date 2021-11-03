import React, { ReactElement, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import DataTable from '../../components/common/DataTable';
import {
  Grid,
  Typography,
  TextField,
  makeStyles,
  InputAdornment,
  Box,
  Chip,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import useDebounce from '../../hooks/useDebounce';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';
import { asyncGetSubscriptions } from '../../redux/slices/paymentsSlice';
import { Subscription } from '../../models/payments/PaymentsModels';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import ViewSubscription from '../../components/payments/ViewSubscription';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1.5),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1.5),
  },
  actions: {
    marginBottom: '5px',
  },
  noSubscriptions: {
    textAlign: 'center',
    marginTop: '200px',
  },
}));

const Subscriptions = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const originalSubscriptionState = {
    _id: '',
    product: '',
    userId: '',
    customerId: '',
    iamport: {
      nextPaymentId: '',
    },
    activeUntil: '',
    transactions: [],
    provider: '',
    createdAt: '',
    updatedAt: '',
  };

  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription>(originalSubscriptionState);

  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(asyncGetSubscriptions({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  const { subscriptions, count } = useAppSelector(
    (state) => state.paymentsSlice.data.subscriptionData
  );

  const handleClose = () => {
    setDrawer(false);
    setSelectedSubscription(originalSubscriptionState);
  };

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

  const formatData = (data: Subscription[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        product: u.product,
        activeUntil: u.activeUntil,
        'Updated At': u.updatedAt,
      };
    });
  };

  const handleAction = (action: { title: string; type: string }, data: Subscription) => {
    const currentTransaction = subscriptions?.find((subscription) => subscription._id === data._id);

    if (currentTransaction !== undefined) {
      if (action.type === 'view') {
        setSelectedSubscription(currentTransaction);
        setDrawer(true);
      }
    }
  };

  const handleSelect = (id: string) => {
    const newSelectedSubscriptions = [...selectedSubscriptions];

    if (selectedSubscriptions.includes(id)) {
      const index = newSelectedSubscriptions.findIndex((newId) => newId === id);
      newSelectedSubscriptions.splice(index, 1);
    } else {
      newSelectedSubscriptions.push(id);
    }
    setSelectedSubscriptions(newSelectedSubscriptions);
  };

  const handleSelectAll = (data: any[]) => {
    if (setSelectedSubscriptions.length === subscriptions.length) {
      setSelectedSubscriptions([]);
      return;
    }
    const newSelectedTransactions = data.map((item: any) => item._id);
    setSelectedSubscriptions(newSelectedTransactions);
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Product', sort: 'product' },
    { title: 'Active until', sort: 'actuveUntil' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toView];

  return (
    <div>
      <Grid container item xs={12} justify="space-between" className={classes.actions}>
        <Grid item>
          {subscriptions && (
            <TextField
              size="small"
              variant="outlined"
              name="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              label="Find transaction"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Grid>
        <Grid item></Grid>
      </Grid>
      {subscriptions.length > 0 ? (
        <>
          <DataTable
            dsData={formatData(subscriptions)}
            sort={sort}
            setSort={setSort}
            headers={headers}
            handleSelect={handleSelect}
            handleSelectAll={handleSelectAll}
            actions={actions}
            handleAction={handleAction}
            selectedItems={selectedSubscriptions}
          />
          <Grid container style={{ marginTop: '-8px' }}>
            <Grid item xs={7} />
            <Grid item xs={5}>
              <Paginator
                handlePageChange={handlePageChange}
                limit={limit}
                handleLimitChange={handleLimitChange}
                page={page}
                count={count}
              />
            </Grid>
          </Grid>
        </>
      ) : (
        <Box className={classes.noSubscriptions}>
          <Typography>No available subscription data</Typography>
        </Box>
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleClose()} width={1400}>
        <Box>
          <Typography variant="h6" style={{ marginTop: '30px', textAlign: 'center' }}>
            Subscription overview
          </Typography>
          <ViewSubscription subscription={selectedSubscription} />
        </Box>
      </DrawerWrapper>
    </div>
  );
};

Subscriptions.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Subscriptions;
