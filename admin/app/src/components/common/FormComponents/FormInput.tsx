import React, { FC } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';
import { TextFieldProps } from '@material-ui/core/TextField/TextField';

interface FormInputTextProps {
  name: string;
  label: string;
  rows?: number;
  disabled?: boolean;
  typeOfInput?: string;
  rules?: ControllerProps['rules'];
  textFieldProps?: TextFieldProps;
}

export const FormInput: FC<FormInputTextProps> = ({
  name,
  label,
  rows,
  disabled,
  typeOfInput,
  rules,
  textFieldProps,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <TextField
          {...field}
          multiline={rows !== undefined && true}
          rows={rows}
          disabled={disabled}
          helperText={errors[name] ? errors[name].message : null}
          type={typeOfInput}
          error={!!errors[name]}
          fullWidth
          label={label}
          variant="outlined"
          {...textFieldProps}
        />
      )}
    />
  );
};
