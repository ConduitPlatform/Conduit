import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import DataTable from '../../components/common/DataTable';
import { EmailUI } from '../../models/emails/EmailModels';
import { Grid, Typography, TextField, makeStyles, InputAdornment, Box } from '@material-ui/core';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import useDebounce from '../../hooks/useDebounce';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';
import { asyncDeleteTransactions, asyncGetTransactions } from '../../redux/slices/paymentsSlice';
import { Transaction } from '../../models/payments/PaymentsModels';
import ViewTransaction from '../../components/payments/ViewTransaction';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

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
  noTransactions: {
    textAlign: 'center',
    marginTop: '200px',
  },
}));

const Transactions = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const originalTransactionState = {
    _id: '',
    userId: '',
    provider: '',
    product: '',
    quantity: 0,
    data: {},
    updatedAt: '',
    createdAt: '',
  };
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });
  const [openDeleteTransactions, setOpenDeleteTransactions] = useState<boolean>(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction>(originalTransactionState);
  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(
      asyncGetTransactions({
        skip,
        limit,
        search: debouncedSearch,
      })
    );
  }, [dispatch, limit, skip, debouncedSearch]);

  const { transactions, count } = useAppSelector(
    (state) => state.paymentsSlice.data.transactionData
  );

  const handleClose = () => {
    setDrawer(false);
    setSelectedTransaction(originalTransactionState);
    setOpenDeleteTransactions(false);
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

  const getCustomersCallBack = useCallback(() => {
    dispatch(asyncGetTransactions({ skip, limit, search }));
  }, [dispatch, limit, skip, search]);

  const handleDeleteTitle = (transaction: Transaction) => {
    if (selectedTransaction._id === '') {
      return 'Delete selected transactions';
    }
    return `Delete transaction ${transaction._id}`;
  };

  const handleDeleteDescription = (transaction: Transaction) => {
    if (selectedTransaction._id === '') {
      return 'Are you sure you want to delete the selected treansactions?';
    }
    return `Are you sure you want to delete ${transaction._id}? `;
  };
  const deleteButtonAction = () => {
    if (openDeleteTransactions && selectedTransaction._id == '') {
      const params = {
        ids: selectedTransactions,
        getTransactions: getCustomersCallBack,
      };
      dispatch(asyncDeleteTransactions(params));
    } else {
      const params = {
        ids: [`${selectedTransaction._id}`],
        getTransactions: getCustomersCallBack,
      };
      dispatch(asyncDeleteTransactions(params));
    }
    setOpenDeleteTransactions(false);
    setSelectedTransaction(originalTransactionState);
    setSelectedTransactions([]);
  };

  const handleAction = (action: { title: string; type: string }, data: any) => {
    const currentTransaction = transactions?.find((transaction) => transaction._id === data._id);

    if (currentTransaction !== undefined) {
      if (action.type === 'view') {
        setSelectedTransaction(currentTransaction);
        setDrawer(true);
      }
    }
  };

  const handleSelect = (id: string) => {
    const newSelectedTransactions = [...selectedTransactions];

    if (selectedTransactions.includes(id)) {
      const index = newSelectedTransactions.findIndex((newId) => newId === id);
      newSelectedTransactions.splice(index, 1);
    } else {
      newSelectedTransactions.push(id);
    }
    setSelectedTransactions(newSelectedTransactions);
  };

  const handleSelectAll = (data: EmailUI[]) => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
      return;
    }
    const newSelectedTransactions = data.map((item: EmailUI) => item._id);
    setSelectedTransactions(newSelectedTransactions);
  };

  const toDelete = {
    title: 'Delete',
    type: 'delete',
  };

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toView, toDelete];

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

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Provider', sort: 'provider' },
    { title: 'Product', sort: 'product' },
    { title: 'Quantity', sort: 'quantity' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  return (
    <div>
      <Grid container item xs={12} justify="space-between" className={classes.actions}>
        <Grid item>
          {count >= 0 && (
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
      {transactions.length > 0 ? (
        <>
          <DataTable
            sort={sort}
            setSort={setSort}
            headers={headers}
            dsData={formatData(transactions)}
            handleSelect={handleSelect}
            handleSelectAll={handleSelectAll}
            actions={actions}
            handleAction={handleAction}
            selectedItems={selectedTransactions}
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
        <Box className={classes.noTransactions}>
          <Typography>No available transactions</Typography>
        </Box>
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleClose()} width={750}>
        <Box>
          <Typography variant="h6" style={{ marginTop: '30px', textAlign: 'center' }}>
            Transaction overview
          </Typography>
          <ViewTransaction transaction={selectedTransaction} />
        </Box>
      </DrawerWrapper>
      <ConfirmationDialog
        open={openDeleteTransactions}
        handleClose={handleClose}
        title={handleDeleteTitle(selectedTransaction)}
        description={handleDeleteDescription(selectedTransaction)}
        buttonAction={deleteButtonAction}
        buttonText={'Delete'}
      />
    </div>
  );
};

Transactions.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Transactions;
