import React from 'react';
import { Control, Controller } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';

interface FormInputProps {
  name: string;
  control: Control<any>;
  label: string;
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
  disabled,
  required,
  typeOfInput,
  pattern,
  errMsg,
  minimumLength,
  minLengthMsg,
}: FormInputProps) => {
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
