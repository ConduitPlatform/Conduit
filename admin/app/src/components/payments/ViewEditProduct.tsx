import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Cancel, Save } from '@material-ui/icons';
import EditIcon from '@material-ui/icons/Edit';
import React, { useEffect, useState } from 'react';
import {
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  Paper,
  Select,
  Switch,
  MenuItem,
} from '@material-ui/core';
import { Product, reccuringEnum } from '../../models/payments/PaymentsModels';
import sharedClasses from './sharedClasses';

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
  const classes = sharedClasses();

  const initialState = {
    _id: '',
    name: '',
    value: 0,
    currency: '',
    isSubscription: false,
    recurring: reccuringEnum.day,
    recurringCount: 0,
  };

  const [productState, setProductState] = useState<Product>(initialState);

  useEffect(() => {
    if (!create)
      setProductState({
        _id: product._id,
        name: product.name,
        value: product.value,
        currency: product.currency,
        isSubscription: product.isSubscription,
        recurring: product.recurring,
        recurringCount: product.recurringCount,
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
      setProductState(initialState);
      return;
    }
    setProductState({
      _id: product._id,
      name: product.name,
      value: product.value,
      currency: product.currency,
      isSubscription: product.isSubscription,
      recurring: product.recurring,
      recurringCount: product.recurringCount,
    });
  };

  const currencies = [
    {
      value: 'USD',
      label: '$',
    },
    {
      value: 'EUR',
      label: '€',
    },
    {
      value: 'BTC',
      label: '฿',
    },
    {
      value: 'JPY',
      label: '¥',
    },
  ];

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
                <Grid item xs={8} style={{ marginTop: '10px' }}>
                  <TextField
                    className={classes.textField}
                    label={'Value'}
                    variant={'outlined'}
                    type="number"
                    value={productState.value}
                    onChange={(event) => {
                      setProductState({
                        ...productState,
                        value: parseInt(event.target.value, 10),
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={4} style={{ marginTop: '10px' }}>
                  <TextField
                    fullWidth
                    variant={'outlined'}
                    select
                    label="Currency"
                    value={productState.currency}
                    onChange={(event) => {
                      setProductState({ ...productState, currency: event.target.value });
                    }}>
                    {currencies.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Paper elevation={6} className={classes.paper} style={{ width: '100%' }}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={productState.isSubscription}
                          onChange={() => {
                            setProductState({
                              ...productState,
                              isSubscription: !productState.isSubscription,
                            });
                          }}
                          inputProps={{ 'aria-label': 'controlled' }}
                        />
                      }
                      label="Subscription"
                    />
                  </Grid>
                  {productState.isSubscription && (
                    <>
                      <Grid item xs={12} style={{ marginTop: '10px' }}>
                        <FormControl variant="outlined" fullWidth>
                          <InputLabel id="demo-simple-select-label">Recurs</InputLabel>
                          <Select
                            labelId="demo-simple-select-label"
                            id="demo-simple-select"
                            label="Recurs"
                            value={productState.recurring}
                            onChange={(event) => {
                              setProductState({
                                ...productState,
                                recurring: event.target.value as reccuringEnum,
                              });
                            }}>
                            <MenuItem value={reccuringEnum.day}>Daily</MenuItem>
                            <MenuItem value={reccuringEnum.week}>Weekly</MenuItem>
                            <MenuItem value={reccuringEnum.month}>Monthly</MenuItem>
                            <MenuItem value={reccuringEnum.year}>Yearly</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} style={{ marginTop: '10px' }}>
                        <TextField
                          className={classes.textField}
                          label={'Recurring count'}
                          variant={'outlined'}
                          type="number"
                          value={productState.recurringCount}
                          onChange={(event) => {
                            setProductState({
                              ...productState,
                              recurringCount: parseInt(event.target.value, 10),
                            });
                          }}
                        />
                      </Grid>
                    </>
                  )}
                </Paper>
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography
                    variant="h5"
                    align="center"
                    color="primary"
                    style={{ marginTop: '-20px' }}>
                    {productState.name}
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="subtitle2">Value:</Typography>
                  <Typography variant="h6">{productState.value}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="subtitle2">Currency:</Typography>
                  <Typography variant="h6">{productState.currency}</Typography>
                </Grid>
                {productState.isSubscription && (
                  <>
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
                onClick={handleSaveClick}>
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
