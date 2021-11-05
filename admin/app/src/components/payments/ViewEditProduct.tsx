import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import React, { useEffect, useState } from 'react';
import {
  FormControl,
  FormControlLabel,
  InputLabel,
  Paper,
  Select,
  Switch,
  MenuItem,
} from '@material-ui/core';
import { Product, reccuringEnum } from '../../models/payments/PaymentsModels';
import sharedClasses from '../common/sharedClasses';
import ExtractView from './ExtractView';
import DrawerButtons from '../common/DrawerButtons';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import { useAppDispatch } from '../../redux/store';

interface Props {
  handleCreate: (product: Product) => void;
  handleSave: (product: Product) => void;
  product: Product;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
  handleClose: () => void;
}

const ViewEditProduct: React.FC<Props> = ({
  handleCreate,
  handleSave,
  product,
  edit,
  setEdit,
  create,
  setCreate,
  handleClose,
}) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();

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
      handleClose();
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

  const handleNameChange = (value: string) => {
    const regex = /[^a-z0-9_]/gi;
    if (regex.test(value)) {
      dispatch(
        enqueueInfoNotification(
          'The product name can only contain alpharithmetics and _',
          'duplicate'
        )
      );
    }

    setProductState({
      ...productState,
      name: value.replace(/[^a-z0-9_]/gi, ''),
    });
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
                    onChange={(e) => handleNameChange(e.target.value)}
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
              <ExtractView valuesToShow={productState} />
            )}
          </Grid>
        </Paper>
        <Divider className={classes.divider} />

        <DrawerButtons
          edit={edit}
          setEdit={setEdit}
          handleCancelClick={handleCancelClick}
          handleSaveClick={handleSaveClick}
        />
      </Box>
    </Container>
  );
};

export default ViewEditProduct;
