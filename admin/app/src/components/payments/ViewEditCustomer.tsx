import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { Cancel } from '@material-ui/icons';
import React from 'react';
import { Button, Paper } from '@material-ui/core';
import { useAppDispatch } from '../../redux/store';
import { Customer } from '../../models/payments/PaymentsModels';
import { enqueueErrorNotification } from '../../utils/useNotifier';

import sharedClasses from '../common/sharedClasses';
import ExtractView from './ExtractView';
import CustomerForm from './Forms/CustomerForm';

interface Props {
  handleCreate: (customer: Customer) => void;
  handleSave: (customer: Customer) => void;
  customer: Customer;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
  handleClose: () => void;
}

const ViewEditCustomer: React.FC<Props> = ({
  handleCreate,
  handleSave,
  customer,
  edit,
  setEdit,
  create,
  setCreate,
  handleClose,
}) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();

  const handleSaveClick = (data: Customer) => {
    const regex = /^\S+@\S+\.\S+$/;
    if (!regex.test(data.email)) {
      dispatch(
        enqueueErrorNotification('The email address you provided is not valid', 'emailError')
      );
      return;
    }
    if (create) {
      handleCreate(data);
    } else {
      handleSave(data);
    }
    setCreate(false);
    setEdit(!edit);
  };

  return (
    <Container>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2} justify="space-around">
            {edit ? (
              <CustomerForm preloadedValues={customer} handleSubmitData={handleSaveClick} />
            ) : (
              <ExtractView valuesToShow={customer} />
            )}
          </Grid>
        </Paper>
        <Grid container item xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          {!edit && (
            <Button
              disabled
              variant="contained"
              color="primary"
              startIcon={<Cancel />}
              onClick={() => setEdit(true)}>
              Edit
            </Button>
          )}
        </Grid>
      </Box>
    </Container>
  );
};

export default ViewEditCustomer;
