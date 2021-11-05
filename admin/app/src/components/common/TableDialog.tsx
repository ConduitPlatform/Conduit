import React, { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Users from '../../pages/authentication/users';
import { InputAdornment, makeStyles, TextField } from '@material-ui/core';
import DataTable from './DataTable';
import Paginator from './Paginator';
import SearchIcon from '@material-ui/icons/Search';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import useDebounce from '../../hooks/useDebounce';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
}));

interface Props {
  open: boolean;
  title?: string;
  headers?: { title: string; sort: string }[];
  returnSelected: string[];
  buttonAction?: () => void;
  handleClose: () => void;
}

const TableDialog: React.FC<Props> = ({
  open,
  title,
  headers,
  navigation,

  buttonAction,
  handleClose,
}) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');

  const debouncedSearch: string = useDebounce(search, 500);

  const { users, count } = useAppSelector((state) => state.authenticationSlice.data);

  useEffect(() => {
    dispatch(asyncGetAuthUserData({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
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
  return (
    <Dialog
      className={classes.paper}
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description">
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description"></DialogContentText>
        <TextField
          size="small"
          variant="outlined"
          name="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Find template"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <DataTable headers={headers} dsData={users} />
        <Paginator
          count={count}
          limit={limit}
          page={page}
          handleLimitChange={handleLimitChange}
          handlePageChange={handlePageChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button onClick={buttonAction} color="primary" autoFocus>
          <Users />
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TableDialog;
