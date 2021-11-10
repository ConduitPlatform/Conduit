import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';

export const FormInputText = ({ name, control, label }: any) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState: { error }, formState }) => (
        <TextField
          helperText={error ? error.message : null}
          error={!!error}
          onChange={onChange}
          value={value}
          fullWidth
          label={label}
          variant="outlined"
        />
      )}
    />
  );
};
