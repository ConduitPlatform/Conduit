import React from 'react';
import { MenuItem } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';

interface FormSelectProps {
  name: string;
  label: string;
  options: { label: string; value: string }[];
  disabled?: boolean;
  rules?: ControllerProps['rules'];
}

export const FormInputSelect: React.FC<FormSelectProps> = ({
  name,
  label,
  options,
  disabled,
  rules,
}) => {
  const generateSingleOptions = () => {
    return options.map((option: { label: string; value: string }) => {
      return (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      );
    });
  };

  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Controller
      rules={rules}
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          {...field}
          select
          fullWidth
          disabled={disabled}
          helperText={errors[name] ? errors[name].message : null}
          error={!!errors[name]}
          label={label}
          variant="outlined">
          {generateSingleOptions()}
        </TextField>
      )}
    />
  );
};
