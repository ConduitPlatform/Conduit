import React from 'react';
import { Controller } from 'react-hook-form';
import { Checkbox, FormControlLabel } from '@material-ui/core';

export const FormCheckBox = ({ name, control, disabled, label }: any) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState: { error }, formState }) => (
        <FormControlLabel
          control={
            <Checkbox color="primary" onChange={onChange} checked={value} disabled={disabled} />
          }
          label={label}
        />
      )}
    />
  );
};
