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
import { Product } from '../../models/payments/PaymentsModels';

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
    isSubscription: false,
    recurring: '',
    recurringCount: 0,
  });

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
      setProductState({
        _id: '',
        name: '',
        value: 0,
        currency: '',
        isSubscription: false,
        recurring: '',
        recurringCount: 0,
      });
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

  // const handleDisabled = () => {
  //   return productState._id && productState.name && productState.stripe;
  // };

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
                        value: event.target.value,
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
                          onChange={(e) => {
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
                            value={productState.recurring}
                            onChange={(event) => {
                              setProductState({ ...productState, recurring: event.target.value });
                            }}>
                            <MenuItem value={'day'}>Daily</MenuItem>
                            <MenuItem value={'week'}>Weekly</MenuItem>
                            <MenuItem value={'month'}>Monthly</MenuItem>
                            <MenuItem value={'year'}>Yearly</MenuItem>
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
                              recurringCount: event.target.value,
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
