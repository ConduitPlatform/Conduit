import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Cancel, Save } from '@material-ui/icons';
import EditIcon from '@material-ui/icons/Edit';
import React, { useEffect, useState } from 'react';
import Image from 'next/dist/client/image';
import EmailImage from '../../assets/email.svg';
import { Button, Paper } from '@material-ui/core';
import { Product } from '../../models/payments/PaymentsModels';
import { number } from 'prop-types';

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
  },
}));

interface Props {
  handleCreate: (product: Product) => void;
  handleSave: (product: Product) => void;
  product: Product;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
}

const ViewEditProduct: React.FC<Props> = ({
  handleCreate,
  handleSave,
  product,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = useStyles();

  const [productState, setProductState] = useState<Product>({
    _id: '',
    name: '',
    value: 0,
    currency: '',
    isSubscriptions: false,
    recurring: '',
    recurringCount: 0,
    stripe: {
      subscriptionId: '',
      priceId: '',
    },
  });

  useEffect(() => {
    if (!create)
      setProductState({
        _id: product._id,
        name: product.name,
        value: product.value,
        currency: product.currency,
        isSubscriptions: product.isSubscriptions,
        recurring: product.recurring,
        recurringCount: product.recurringCount,
        stripe: {
          subscriptionId: product.stripe.subscriptionId,
          priceId: product.stripe.subscriptionId,
        },
      });
  }, [product, edit, create]);

  const handleSaveClick = () => {
    if (create) {
      handleCreate(productState);
    } else {
      handleSave(productState);
    }
    setCreate(false);
    setEdit(!edit);
  };

  const handleCancelClick = () => {
    if (create) {
      setProductState({
        _id: '',
        name: '',
        value: 0,
        currency: '',
        isSubscriptions: false,
        recurring: '',
        recurringCount: 0,
        stripe: {
          subscriptionId: '',
          priceId: '',
        },
      });
      return;
    }
    setProductState({
      _id: product._id,
      name: product.name,
      value: product.value,
      currency: product.currency,
      isSubscriptions: product.isSubscriptions,
      recurring: product.recurring,
      recurringCount: product.recurringCount,
      stripe: {
        subscriptionId: product.stripe.subscriptionId,
        priceId: product.stripe.subscriptionId,
      },
    });
  };

  const handleDisabled = () => {
    return productState._id && productState.name && productState.stripe;
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
                    label={'Product name'}
                    variant={'outlined'}
                    value={productState.name}
                    onChange={(event) => {
                      setProductState({ ...productState, name: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Currency'}
                    variant={'outlined'}
                    value={productState.currency}
                    onChange={(event) => {
                      setProductState({ ...productState, currency: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Recurs'}
                    variant={'outlined'}
                    value={productState.recurring}
                    onChange={(event) => {
                      setProductState({ ...productState, recurring: event.target.value });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Recurring count'}
                    variant={'outlined'}
                    value={productState.recurringCount}
                    onChange={(event) => {
                      setProductState({
                        ...productState,
                        recurring: event.target.value,
                      });
                    }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Product name:</Typography>
                  <Typography variant="h6">{productState.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Currency:</Typography>
                  <Typography variant="h6">{productState.currency}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Recurs:</Typography>
                  <Typography variant="h6">{productState.recurring}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Reccuring count:</Typography>
                  <Typography variant="h6">{productState.recurringCount}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
        <Divider className={classes.divider} />

        <Grid container item xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          {!edit ? (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<EditIcon />}
              disabled
              onClick={() => setEdit(true)}>
              Edit
            </Button>
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
                onClick={handleSaveClick}
                disabled={!handleDisabled()}>
                Save
              </Button>
            </>
          )}
        </Grid>
      </Box>
    </Container>
  );
};

export default ViewEditProduct;
