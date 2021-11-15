import React from 'react';
import { FormControl, MenuItem, TextField } from '@material-ui/core';
import { Controller } from 'react-hook-form';

export const FormInputDropdown: React.FC<any> = ({ name, control, label, options, disabled }) => {
  const generateSingleOptions = () => {
    return options.map((option: any) => {
      return (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      );
    });
  };

  return (
    <FormControl fullWidth variant="outlined">
      <Controller
        render={({ field: { onChange, value }, formState: { errors } }) => (
          <TextField
            disabled={disabled}
            select
            fullWidth
            value={value}
            label={label}
            onChange={onChange}
            variant="outlined">
            {generateSingleOptions()}
          </TextField>
        )}
        control={control}
        name={name}
      />
    </FormControl>
  );
};
