import React, { useState } from 'react';
import Pagination from '@material-ui/lab/Pagination';
import Grid from '@material-ui/core/Grid';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Button from '@material-ui/core/Button';
import TablePagination from '@material-ui/core/TablePagination';
import { useSelector } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  paginator: {
    '& > *': {
      marginBottom: '10px',
    },
  },
}));

export default function Paginator({ handlePageChange, page, limit, handleLimitChange }) {
  const classes = useStyles();

  const docs = useSelector(
    (state) => state.authenticationPageReducer.authUsersState.count
  );
  return (
    <Grid container justify="flex-end">
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={docs}
        page={page}
        onChangePage={handlePageChange}
        rowsPerPage={limit}
        onChangeRowsPerPage={handleLimitChange}
      />
      {/* <ButtonGroup
        variant="text"
        color="secondary"
        aria-label="contained primary button group">
        <Button onClick={() => handleLimitChange(5)}>5</Button>
        <Button onClick={() => handleLimitChange(10)}>10</Button>
        <Button onClick={() => handleLimitChange(15)}>15</Button>
      </ButtonGroup>

      <Pagination
        className={classes.paginator}
        color="secondary"
        page={page}
        onChange={handlePageChange}
        count={Math.ceil(docs / limit)}
      /> */}
    </Grid>
  );
}
