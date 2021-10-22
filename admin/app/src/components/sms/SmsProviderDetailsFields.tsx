import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { ChildConfigKey, ConfigKey, TwilioConfig } from '../../models/sms/SmsModels';
import { isString, isBoolean } from 'lodash';
import Switch from '@material-ui/core/Switch';

const useStyles = makeStyles((theme) => ({
  fieldSpace: {
    marginBottom: theme.spacing(1),
  },
}));

//data.verify needs to be dynamic in the future

interface Props {
  data: TwilioConfig;
  onChange: (value: string | boolean, key: ConfigKey, childKey?: ChildConfigKey) => void;
}

const SmsProviderDetailsFields: React.FC<Props> = ({ data, onChange }) => {
  const classes = useStyles();

  const handleInput = (isSwitch: boolean, key: ConfigKey, childKey?: ChildConfigKey) => {
    if (isSwitch) {
      return (
        <>
          <Typography variant={'body1'}>{childKey}:</Typography>
          <Switch
            size="medium"
            color="primary"
            checked={childKey ? !!data.verify[childKey] : !!data[key]}
            onChange={(event) => onChange(event.target.checked, key, childKey)}
          />
        </>
      );
    }
    return (
      <TextField
        value={childKey ? data.verify[childKey] : data[key]}
        onChange={(event) => onChange(event.target.value, key, childKey)}
        className={classes.fieldSpace}
        required
        id={`${key}${childKey}`}
        label={childKey ? childKey : key}
        variant="outlined"
      />
    );
  };

  const handleFields = () => {
    const keys = Object.keys(data) as ConfigKey[];
    if (keys && Array.isArray(keys) && keys.length > 0) {
      return keys.map((key, index) => {
        if (!isString(data[key])) {
          const childKeys = Object.keys(data[key]) as ChildConfigKey[];
          return childKeys.map((childKey, idx) => {
            return (
              <Grid container alignItems="center" item xs={12} key={`${childKey}${idx}`}>
                {handleInput(isBoolean(data.verify[childKey]), key, childKey)}
              </Grid>
            );
          });
        }
        return (
          <Grid item xs={12} key={`${key}${index}`}>
            {handleInput(isBoolean(data[key]), key)}
          </Grid>
        );
      });
    }
    return <>N/A</>;
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant={'h6'}>Provider settings</Typography>
      </Grid>
      {handleFields()}
    </>
  );
};

export default SmsProviderDetailsFields;
