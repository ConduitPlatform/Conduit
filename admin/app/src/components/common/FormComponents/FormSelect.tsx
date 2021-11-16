import React from 'react';
import { MenuItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import { Control, Controller } from 'react-hook-form';

interface FormSelectProps {
  name: string;
  control: Control<any>;
  label: string;
  options: { name: string; label: string }[];
  disabled?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  name,
  control,
  label,
  options,
  disabled,
}) => {
  const generateSingleOptions = () => {
    return options.map((option: { name: string; label: string }) => {
      return (
        <MenuItem key={option.name} value={option.name}>
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
          variant="outlined">
          {generateSingleOptions()}
        </TextField>
      )}
      control={control}
      name={name}
    />
  );
};
