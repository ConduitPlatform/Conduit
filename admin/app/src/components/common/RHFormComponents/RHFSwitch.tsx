import React from 'react';
import { Controller } from 'react-hook-form';
import { Switch } from '@material-ui/core';

export const FormSwitch = ({ name, control, disabled }: any) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value } }) => (
        <Switch onChange={onChange} checked={value} disabled={disabled} />
      )}
    />
  );
};
