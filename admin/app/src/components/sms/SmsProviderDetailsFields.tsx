import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { ConfigKey, TwilioConfig } from '../../models/sms/SmsModels';
import { isString } from 'lodash';

const useStyles = makeStyles((theme) => ({
  fieldSpace: {
    marginBottom: theme.spacing(1),
  },
}));

interface Props {
  data: TwilioConfig;
}

const SmsProviderDetailsFields: React.FC<Props> = ({ data }) => {
  const classes = useStyles();

  const handleTextField = (key: string, childKey?: string) => {
    return (
      <TextField
        // value={accountSID}
        // onChange={(e) => setAccountSID(e.target.value)}
        className={classes.fieldSpace}
        required
        // id="sid"
        label={key}
        variant="outlined"
      />
    );
  };

  const handleFields = () => {
    const keys = Object.keys(data) as ConfigKey[];
    if (keys && Array.isArray(keys) && keys.length > 0) {
      return keys.map((key, index) => {
        if (!isString(data[key])) {
          const childKeys = Object.keys(data[key]);
          return childKeys.map((childKey, index) => {
            return (
              <Grid item xs={12} key={`${childKey}${index}`}>
                {handleTextField(key, childKey)}
              </Grid>
            );
          });
        }
        return (
          <Grid item xs={12} key={`${key}${index}`}>
            {handleTextField(key)}
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
