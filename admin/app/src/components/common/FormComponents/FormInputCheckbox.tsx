import React from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';
import { Checkbox, FormControlLabel } from '@material-ui/core';

interface FormCheckboxProps {
  name: string;
  label: string;
  disabled?: boolean;
  rules?: ControllerProps['rules'];
}

export const FormInputCheckBox: React.FC<FormCheckboxProps> = ({
  name,
  disabled,
  label,
  rules,
}) => {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormControlLabel
          control={
            <Checkbox {...field} color="primary" checked={field.value} disabled={disabled} />
          }
          label={label}
        />
      )}
    />
  );
};
