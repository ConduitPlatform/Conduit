import React, { FC, useEffect } from 'react';
import sharedClasses from '../../common/sharedClasses';
import { useForm, useWatch } from 'react-hook-form';
import { Button, Container, Grid, Paper, Typography } from '@material-ui/core';
import { Product, reccuringEnum } from '../../../models/payments/PaymentsModels';
import { FormInput } from '../../common/FormComponents/FormInput';
import { FormSelect } from '../../common/FormComponents/FormSelect';
import { FormSwitch } from '../../common/FormComponents/FormSwitch';

interface Props {
  preloadedValues: Product;
  handleSubmitData: (data: Product) => void;
}

interface IProductForm {
  name: string;
  value: number;
  currency: string;
  isSubscription: boolean;
  recurring: reccuringEnum;
  recurringCount: number;
}

const ProductForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();
  const methods = useForm<IProductForm>({ defaultValues: preloadedValues });

  const { handleSubmit, reset, control, setValue } = methods;

  const isSubscription = useWatch({
    control,
    name: 'isSubscription',
  });

  useEffect(() => {
    setValue('currency', preloadedValues.currency.toLowerCase());
    setValue('recurring', reccuringEnum[preloadedValues.recurring]);
  }, [setValue, preloadedValues]);

  const onSubmit = (data: Product) => {
    handleSubmitData(data);
  };

  const currencies = [
    {
      value: '',
      label: 'None',
    },
    {
      value: 'usd',
      label: '$',
    },
    {
      value: 'eur',
      label: '€',
    },
    {
      value: 'btc',
      label: '฿',
    },
    {
      value: 'jpy',
      label: '¥',
    },
  ];

  const recuringOptions = [
    { value: reccuringEnum.day, label: 'Daily' },
    {
      value: reccuringEnum.week,
      label: 'Weekly',
    },
    {
      value: reccuringEnum.month,
      label: 'Monthly',
    },
    {
      value: reccuringEnum.year,
      label: 'Yearly',
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <FormInput
              name="name"
              control={control}
              label="Name"
              required={'Product name is required'}
            />
          </Grid>
          <Grid item sm={6}>
            <FormInput
              name="value"
              control={control}
              label="Value"
              typeOfInput="number"
              required={'Value is required'}
              pattern={/^(?=.*[0-9])\d{1,3}(?:\.\d\d?)?$/}
              errMsg={'Negative numbers not allowed'}
            />
          </Grid>
          <Grid item sm={6}>
            <FormSelect options={currencies} name="currency" control={control} label="Currency" />
          </Grid>
          <Paper elevation={6} className={classes.paper} style={{ width: '100%' }}>
            <Grid item container sm={12}>
              <Grid item sm={6}>
                <Typography>Is subscription:</Typography>
              </Grid>
              <Grid item sm={6}>
                <FormSwitch name="isSubscription" control={control} />
              </Grid>
            </Grid>
            {isSubscription && (
              <>
                <Grid item sm={12}>
                  <FormSelect
                    options={recuringOptions}
                    name="recurring"
                    control={control}
                    label="Recurring"
                  />
                </Grid>
                <Grid item sm={12} style={{ marginTop: '10px' }}>
                  <FormInput
                    name="recurringCount"
                    control={control}
                    label="Recurring count"
                    typeOfInput="number"
                    pattern={/^(?=.*[0-9])\d{1,3}(?:\.\d\d?)?$/}
                    errMsg={'Negative number not allowed'}
                  />
                </Grid>
              </>
            )}
          </Paper>
          <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
            <Grid item>
              <Button type="submit" variant="contained" color="primary" size="large">
                Save
              </Button>
            </Grid>
            <Grid item>
              <Button onClick={() => reset()} variant="contained" color="primary" size="large">
                Cancel
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </form>
  );
};

export default ProductForm;
