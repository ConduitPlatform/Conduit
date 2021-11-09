import React, { FC } from 'react';
import sharedClasses from '../../common/sharedClasses';
import { useForm, Controller } from 'react-hook-form';
import { Button, Container, Grid, MenuItem, Paper, Switch, TextField } from '@material-ui/core';
import ReactHookFormSelect from '../../../hooks/ReactHookFormSelect';
import { reccuringEnum } from '../../../models/payments/PaymentsModels';

interface Props {
  preloadedValues: any;
  handleSubmitData: (data: any) => void;
}

const ProductForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();

  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: preloadedValues,
  });

  const handleCancel = () => {
    reset();
  };

  const onSubmit = (data: any) => {
    handleSubmitData(data);
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
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <Controller
              {...register('name', { required: true })}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  className={classes.textField}
                  label={'Product name'}
                  variant={'outlined'}
                  value={value}
                  onChange={onChange}
                />
              )}
              rules={{ required: 'Name required' }}
            />
          </Grid>
          <Grid item sm={12}>
            <Controller
              {...register('value', { required: true })}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  fullWidth
                  className={classes.textField}
                  value={value}
                  label={'Value'}
                  variant={'outlined'}
                  onChange={onChange}
                />
              )}
              rules={{ required: 'Project value required' }}
            />
          </Grid>
          {/* <Grid item sm={12}>
            <ReactHookFormSelect
              {...register('currency', { required: true })}
              className={classes.textField}
              label="Currency"
              control={control}
              defaultValue={`EUR`}
              variant="outlined"
              margin="normal">
              {currencies.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </ReactHookFormSelect>
          </Grid> */}
          <Paper elevation={6} className={classes.paper} style={{ width: '100%' }}>
            <Grid item sm={12}>
              <Controller
                {...register('subscription', { required: true })}
                control={control}
                defaultValue={false}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <Switch value={value} onChange={onChange} />
                  </>
                )}
              />
            </Grid>
            {/* <Grid item sm={12}>
              <ReactHookFormSelect
                {...register('recurring', { required: true })}
                className={classes.textField}
                label="Em quantas parcelas?"
                control={control}
                defaultValue={reccuringEnum.day}
                variant="outlined"
                margin="normal">
                <MenuItem value={reccuringEnum.day}>Daily</MenuItem>
                <MenuItem value={reccuringEnum.week}>Weekly</MenuItem>
                <MenuItem value={reccuringEnum.month}>Monthly</MenuItem>
                <MenuItem value={reccuringEnum.year}>Yearly</MenuItem>
              </ReactHookFormSelect>
            </Grid> */}
            <Grid item sm={12} style={{ marginTop: '10px' }}>
              <Controller
                {...register('recurringCount', { required: true })}
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextField
                    className={classes.textField}
                    label={'Recurring count'}
                    variant={'outlined'}
                    value={value}
                    onChange={onChange}
                  />
                )}
                rules={{ required: 'Rec. count is required!' }}
              />
            </Grid>
          </Paper>
          <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
            <Grid item>
              <Button type="submit" variant="contained" color="primary" size="large">
                Save
              </Button>
            </Grid>
            <Grid item>
              <Button
                onClick={() => handleCancel()}
                variant="contained"
                color="primary"
                size="large">
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
