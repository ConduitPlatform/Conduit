import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Switch } from '@material-ui/core';

interface FormSwitchProps {
  name: string;
  control: Control<any>;
  disabled: boolean;
}

export const FormSwitch: React.FC<FormSwitchProps> = ({ name, control, disabled }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value } }) => (
        <Switch color="primary" onChange={onChange} checked={value} disabled={disabled} />
      )}
    />
  );
};
