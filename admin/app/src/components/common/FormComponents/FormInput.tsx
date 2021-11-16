import React from 'react';
import { Controller } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';

interface RHFInputTextProps {
  name: string;
  control: any;
  label: string;
  rows?: number;
  disabled?: boolean;
  required?: string;
  typeOfInput?: string;
  pattern?: RegExp;
  errMsg?: string;
  minimumLength?: number;
  minLengthMsg?: string;
}

export const FormInput = ({
  name,
  control,
  label,
  rows,
  disabled,
  required,
  typeOfInput,
  pattern,
  errMsg,
  minimumLength,
  minLengthMsg,
}: RHFInputTextProps) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required,
        pattern: pattern && {
          value: pattern,
          message: errMsg !== undefined ? errMsg : '',
        },
        minLength: minimumLength && {
          value: minimumLength,
          message: minLengthMsg !== undefined ? minLengthMsg : '',
        },
      }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
          multiline={rows !== undefined && true}
          rows={rows}
          disabled={disabled}
          helperText={error ? error.message : null}
          type={typeOfInput}
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
