import React from 'react';
import Grid from '@material-ui/core/Grid';
import TablePagination from '@material-ui/core/TablePagination';

interface Props {
  page: number;
  limit: number;
  handlePageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  handleLimitChange: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
  count: number;
}

const Paginator: React.FC<Props> = ({
  handlePageChange,
  page,
  limit,
  handleLimitChange,
  count,
}) => {
  return (
    <Grid container justify="flex-end">
      <TablePagination
        color="primary"
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={count}
        page={page}
        onChangePage={handlePageChange}
        rowsPerPage={limit}
        onChangeRowsPerPage={handleLimitChange}
      />
    </Grid>
  );
};

export default Paginator;
