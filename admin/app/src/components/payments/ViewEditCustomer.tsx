import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import { Cancel, Save } from '@material-ui/icons';
import Image from 'next/dist/client/image';
import CustomerIcon from '../../assets/svgs/customer.svg';
import React, { useEffect, useState } from 'react';
import { Button, FormControl, InputLabel, MenuItem, Paper, Select } from '@material-ui/core';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { Customer } from '../../models/payments/PaymentsModels';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { asyncGetAuthUserData } from '../../redux/slices/authenticationSlice';
import { AuthUser } from '../../models/authentication/AuthModels';
import sharedClasses from './sharedClasses';
import ExtractView from './ExtractView';

interface Props {
  handleCreate: (customer: Customer) => void;
  handleSave: (customer: Customer) => void;
  customer: Customer;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
}

const ViewEditCustomer: React.FC<Props> = ({
  handleCreate,
  handleSave,
  customer,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();
  const [select, setSelect] = useState<string | number>(-1);

  const { users } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const initialState = {
    _id: '',
    userId: '',
    email: '',
    buyerName: '',
    phoneNumber: '',
    address: '',
    postCode: '',
    stripe: {
      customerId: '',
    },
  };

  const [customerState, setCustomerState] = useState<Customer>(initialState);

  useEffect(() => {
    dispatch(asyncGetAuthUserData({ skip: 0, limit: 100, search: '', filter: 'all' }));
  }, [dispatch]);

  useEffect(() => {
    if (!create)
      setCustomerState({
        _id: customer._id,
        userId: customer.userId,
        email: customer.email,
        buyerName: customer.buyerName,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        postCode: customer.postCode,
        stripe: {
          customerId: customer.stripe.customerId,
        },
      });
  }, [customer, edit, create]);

  const handleSaveClick = () => {
    const regex = /^\S+@\S+\.\S+$/;
    if (!regex.test(customerState.email)) {
      dispatch(
        enqueueErrorNotification('The email address you provided is not valid', 'emailError')
      );
      return;
    }
    if (create) {
      handleCreate(customerState);
    } else {
      handleSave(customerState);
    }
    setCreate(false);
    setEdit(!edit);
  };

  const handleCancelClick = () => {
    if (create) {
      setCustomerState(initialState);
      return;
    }
    setCustomerState({
      _id: customer._id,
      userId: customer.userId,
      email: customer.email,
      buyerName: customer.buyerName,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
      postCode: customer.postCode,
      stripe: {
        customerId: customer.stripe.customerId,
      },
    });
  };

  const extractLabel = () => {
    switch (select) {
      case -1:
        return 'Select user';
      default:
        return 'Selected user';
    }
  };

  const handleUserChange = (e: React.ChangeEvent<any>) => {
    setSelect(e.target.value);

    const foundUser = users.find((user: AuthUser) => user._id === e.target.value);

    if (e.target.value !== '' && foundUser !== undefined)
      setCustomerState({ ...customerState, userId: foundUser._id });
    else setCustomerState({ ...customerState, userId: '' });
  };

  return (
    <Container className={classes.marginTop}>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2} justify="space-around">
            {edit ? (
              <>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Customer email'}
                    variant={'outlined'}
                    value={customerState.email}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, email: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel>{extractLabel()}</InputLabel>
                    <Select label="Select user" value={select} onChange={handleUserChange}>
                      <MenuItem value={-1}>
                        <em>None</em>
                      </MenuItem>
                      {users.length > 0 &&
                        users.map((user, index: number) => (
                          <MenuItem key={index} value={user._id}>
                            {user.email}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Buyer name'}
                    variant={'outlined'}
                    value={customerState.buyerName}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, buyerName: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Phone number'}
                    variant={'outlined'}
                    value={customerState.phoneNumber}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, phoneNumber: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Address'}
                    variant={'outlined'}
                    value={customerState.address}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, address: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Post code'}
                    variant={'outlined'}
                    value={customerState.postCode}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, postCode: event.target.value });
                    }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <ExtractView valuesToShow={customerState} />
              </>
            )}
          </Grid>
        </Paper>
        <Divider className={classes.divider} />

        <Grid container item xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          {!edit ? (
            ''
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Cancel />}
                onClick={handleCancelClick}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Save />}
                onClick={handleSaveClick}>
                Save
              </Button>
            </>
          )}
        </Grid>
        <div className={classes.centeredImg}>
          <Image src={CustomerIcon} width="200px" alt="customer" />
        </div>
      </Box>
    </Container>
  );
};

export default ViewEditCustomer;
