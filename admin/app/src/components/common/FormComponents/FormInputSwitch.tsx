import React from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';
import { Switch, SwitchProps } from '@material-ui/core';

interface FormSwitchProps {
  name: string;
  disabled: boolean;
  rules?: ControllerProps['rules'];
  switchProps?: SwitchProps;
}

export const FormInputSwitch: React.FC<FormSwitchProps> = ({
  name,
  disabled,
  rules,
  switchProps,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  return (
    <Controller
      name={name}
      rules={rules}
      control={control}
      render={({ field }) => (
        <Switch
          {...field}
          checked={field.value}
          color="primary"
          disabled={disabled}
          {...switchProps}
        />
      )}
    />
  );
};
