import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Cancel, Save } from '@material-ui/icons';
import Image from 'next/dist/client/image';
import CustomerIcon from '../../assets/svgs/customer.svg';
import React, { useEffect, useState } from 'react';
import { Button, Paper } from '@material-ui/core';
import { useAppDispatch } from '../../redux/store';
import { Customer } from '../../models/payments/PaymentsModels';
import { enqueueErrorNotification } from '../../utils/useNotifier';

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'center',
    justifySelf: 'center',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
    marginBottom: theme.spacing(3),
  },
  textField: {
    width: '100%',
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
  marginTop: {
    marginTop: '60px',
  },
  centeredImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-30px',
  },
}));

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
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [customerState, setCustomerState] = useState<Customer>({
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
  });

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
      setCustomerState({
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
      });
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

  const handleDisabled = () => {
    return customerState.buyerName && customerState._id && customerState.stripe;
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
                  <TextField
                    className={classes.textField}
                    label={'User Id'}
                    variant={'outlined'}
                    value={customerState.userId}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, userId: event.target.value });
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
                {/* <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Stripe ID'}
                    variant={'outlined'}
                    value={customerState.stripe.customerId}
                    onChange={(event) => {
                      setCustomerState({ ...customerState, email: event.target.value });
                    }}
                  />
                </Grid> */}
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Template name:</Typography>
                  <Typography variant="h6">{customerState.email}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Sender:</Typography>
                  <Typography variant="h6">{customerState.userId}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Phone number:</Typography>
                  <Typography variant="h6">{customerState.phoneNumber}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Address:</Typography>
                  <Typography variant="h6">{customerState.address}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Postal code:</Typography>
                  <Typography variant="h6">{customerState.postCode}</Typography>
                </Grid>
                {/* <Grid item xs={12}>
                  <Typography variant="subtitle2">Stripe ID:</Typography>
                  <Typography variant="h6">{customerState.stripe.customerId}</Typography>
                </Grid> */}
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
