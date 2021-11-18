import React, { useEffect, useState } from 'react';
import {
  Typography,
  DialogContent,
  DialogActions,
  DialogTitle,
  Dialog,
  Button,
  InputAdornment,
  makeStyles,
  TextField,
  IconButton,
} from '@material-ui/core';

import DataTable from './DataTable';
import Paginator from './Paginator';
import { Search as SearchIcon, Close } from '@material-ui/icons';
import useDebounce from '../../hooks/useDebounce';

const useStyles = makeStyles((theme) => ({
  paper: {},
  typography: {
    marginBottom: theme.spacing(4),
  },
  closeButton: {
    position: 'absolute',
    right: '8px',
    top: '8px',
    color: theme.palette.secondary.main,
  },
}));

interface Props {
  open: boolean;
  title?: string;
  headers?: { title: string; sort: string }[];
  returnSelected?: string[];
  buttonText?: string;
  handleClose: () => void;
  data: { tableData: any[]; count: number };
  getData: any;
  externalElements?: string[];
  setExternalElements?: (values: string[]) => void;
}

const TableDialog: React.FC<Props> = ({
  open,
  title,
  headers,
  buttonText,
  handleClose,
  data,
  getData,
  externalElements,
  setExternalElements,
}) => {
  const classes = useStyles();

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    getData({ skip, limit, search, debouncedSearch });
  }, [skip, limit, search, debouncedSearch, getData]);

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
  };

  useEffect(() => {
    if (externalElements !== undefined && externalElements.length >= 0) {
      setSelectedElements(externalElements);
    }
  }, [externalElements]);

  const handleSelect = (id: string) => {
    const newSelectedElements = [...selectedElements];

    if (selectedElements.includes(id)) {
      const index = newSelectedElements.findIndex((newId) => newId === id);
      newSelectedElements.splice(index, 1);
    } else {
      newSelectedElements.push(id);
    }
    setSelectedElements(newSelectedElements);
  };

  const handleAction = () => {
    if (externalElements !== undefined && setExternalElements !== undefined)
      setExternalElements(selectedElements);
    handleClose();
  };

  const handleSelectAll = (elements: any) => {
    if (selectedElements.length === elements.length) {
      setSelectedElements([]);
      return;
    }
    const newSelectedElements = elements.map((item: any) => item._id);
    setSelectedElements(newSelectedElements);
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
      fullWidth
      maxWidth="lg"
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description">
      <IconButton aria-label="Close" className={classes.closeButton} onClick={handleClose}>
        <Close />
      </IconButton>
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          variant="outlined"
          name="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        {data.tableData.length ? (
          <>
            <DataTable
              headers={headers}
              dsData={data.tableData}
              handleSelect={handleSelect}
              handleSelectAll={handleSelectAll}
              selectedItems={selectedElements}
            />
            <Paginator
              count={data.count}
              limit={limit}
              page={page}
              handleLimitChange={handleLimitChange}
              handlePageChange={handlePageChange}
            />
          </>
        ) : (
          <Typography>No content available </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button
          disabled={selectedElements.length < 1}
          onClick={() => handleAction()}
          color="secondary"
          variant="contained"
          autoFocus>
          {buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TableDialog;
