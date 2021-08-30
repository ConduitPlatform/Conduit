import React from 'react';
import Grid from '@material-ui/core/Grid';
import TablePagination from '@material-ui/core/TablePagination';
import { useSelector } from 'react-redux';

interface Props {
  page: number;
  limit: number;
  handlePageChange: () => void;
  handleLimitChange: () => void;
}

const Paginator: React.FC<Props> = ({
  handlePageChange,
  page,
  limit,
  handleLimitChange,
}) => {
  const docs = useSelector(
    (state: { authenticationPageReducer: { authUsersState: { count: number } } }) =>
      state.authenticationPageReducer.authUsersState.count
  );

  return (
    <Grid container justify="flex-end">
      <TablePagination
        color="primary"
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={docs}
        page={page}
        onChangePage={handlePageChange}
        rowsPerPage={limit}
        onChangeRowsPerPage={handleLimitChange}
      />
    </Grid>
  );
};

export default Paginator;
