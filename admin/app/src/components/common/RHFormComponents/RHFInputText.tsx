import React from 'react';
import { Controller } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';

interface IForm {
  name: string;
  control: any;
  label: string;
  requiredRules?: string;
  typeOfInput?: string;
  pattern?: any;
  errMsg?: any;
  minimumLength?: any;
  minLengthMsg?: any;
}

export const FormInputText = ({
  name,
  control,
  label,
  requiredRules,
  typeOfInput,
  pattern,
  errMsg,
  minimumLength,
  minLengthMsg,
}: IForm) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: requiredRules,
        pattern: {
          value: pattern !== undefined && pattern,
          message: errMsg !== undefined && errMsg,
        },
        minLength: { value: minimumLength, message: minLengthMsg },
      }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
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
