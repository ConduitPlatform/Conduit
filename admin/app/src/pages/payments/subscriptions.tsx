import React, { ReactElement, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import DataTable from '../../components/common/DataTable';
import { Grid, Typography, TextField, makeStyles, InputAdornment, Box } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import useDebounce from '../../hooks/useDebounce';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';
import { asyncGetSubscriptions } from '../../redux/slices/paymentsSlice';
import { Subscription } from '../../models/payments/PaymentsModels';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1.5),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1.5),
  },
  actions: {},
  noSubscriptions: {
    textAlign: 'center',
    marginTop: '200px',
  },
}));

const Subscriptions = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });

  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(asyncGetSubscriptions({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  const { subscriptions, count } = useAppSelector(
    (state) => state.paymentsSlice.data.subscriptionData
  );

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
        provider: u.provider,
        'Updated At': u.updatedAt,
      };
    });
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Product', sort: 'product' },
    { title: 'Active until', sort: 'actuveUntil' },
    { title: 'Provider', sort: 'provider' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  return (
    <div>
      <Grid container item xs={12} justify="space-between" className={classes.actions}>
        <Grid item>
          {count > 0 && (
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
            collapsible={true}
            sort={sort}
            setSort={setSort}
            headers={headers}
            dsData={formatData(subscriptions)}
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
    </div>
  );
};

Subscriptions.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Subscriptions;
