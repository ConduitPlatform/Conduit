import React, { FC, useEffect } from 'react';
import sharedClasses from '../../common/sharedClasses';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Button, Container, Grid, Paper, Typography } from '@material-ui/core';
import { Product, reccuringEnum } from '../../../models/payments/PaymentsModels';
import { FormInputText } from '../../common/FormComponents/FormInputText';
import { FormInputSelect } from '../../common/FormComponents/FormInputSelect';
import { FormInputSwitch } from '../../common/FormComponents/FormInputSwitch';

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

  const onCancel = () => {
    reset();
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
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} style={{}}>
        <Grid container spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              name="name"
              label="Name"
              rules={{ required: 'Product name is required' }}
            />
          </Grid>
          <Grid item sm={6}>
            <FormInputText
              name="value"
              label="Value"
              typeOfInput="number"
              rules={{
                required: 'Value is required',
                pattern: {
                  value: /^(?=.*\d)\d{1,3}(?:\.\d\d?)?$/,
                  message: 'Negative number not allowed',
                },
              }}
            />
          </Grid>
          <Grid item sm={6}>
            <FormInputSelect name="currency" options={currencies} label="Currency" />
          </Grid>
          <Paper className={classes.paper} style={{ width: '100%' }}>
            <Grid item container sm={12}>
              <Grid item sm={11}>
                <Typography>Is subscription:</Typography>
              </Grid>
              <Grid item sm={1}>
                <FormInputSwitch name="isSubscription" />
              </Grid>
            </Grid>
            {isSubscription && (
              <>
                <Grid item sm={12}>
                  <FormInputSelect options={recuringOptions} name="recurring" label="Recurring" />
                </Grid>
                <Grid item sm={12} style={{ marginTop: '10px' }}>
                  <FormInputText
                    name="recurringCount"
                    label="Recurring count"
                    typeOfInput="number"
                    rules={{
                      pattern: {
                        value: /^(?=.*\d)\d{1,3}(?:\.\d\d?)?$/,
                        message: 'Negative number not allowed',
                      },
                    }}
                  />
                </Grid>
              </>
            )}
          </Paper>
          <Grid container item>
            <Grid item className={classes.marginRight}>
              <Button variant="outlined" onClick={() => onCancel()}>
                Cancel
              </Button>
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" type="submit">
                Save
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </FormProvider>
  );
};

export default ProductForm;
