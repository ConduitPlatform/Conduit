import React from 'react';
import { MenuItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
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
    <Controller
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
          select
          fullWidth
          disabled={disabled}
          value={value}
          label={label}
          onChange={onChange}
          helperText="Select your preferred template"
          variant="outlined">
          {generateSingleOptions()}
        </TextField>
      )}
      control={control}
      name={name}
    />
  );
};
