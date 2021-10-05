import React from 'react';
import Grid from '@material-ui/core/Grid';
import TablePagination from '@material-ui/core/TablePagination';
import { useAppSelector } from '../../redux/store';

interface Props {
  page: number;
  limit: number;
  handlePageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  handleLimitChange: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
}

const Paginator: React.FC<Props> = ({ handlePageChange, page, limit, handleLimitChange }) => {
  const docs = useAppSelector((state) => state.authenticationSlice.data.authUsers.count);

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
