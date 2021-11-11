import React from 'react';
import { Controller } from 'react-hook-form';
import { Switch } from '@material-ui/core';

export const FormSwitch = ({ name, control }: any) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState: { error }, formState }) => (
        <Switch onChange={onChange} checked={value} />
      )}
    />
  );
};
