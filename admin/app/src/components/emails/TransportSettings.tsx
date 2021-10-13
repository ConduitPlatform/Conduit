import React from 'react';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EmailSettings, TransportProviders, whatever } from '../../models/emails/EmailModels';

const useStyles = makeStyles((theme) => ({
  input: {
    marginBottom: theme.spacing(2),
  },
}));

interface Props {
  data: EmailSettings;
  onChange: (value: string, key: string, provider: TransportProviders, authItem?: string) => void;
}

const TransportSettings: React.FC<Props> = ({ data, onChange }) => {
  const classes = useStyles();

  const handleChange = (
    value: string,
    key: string,
    provider: TransportProviders,
    authItem?: string
  ) => {
    if (onChange) {
      onChange(value, key, provider, authItem);
    }
  };

  const handleFields = () => {
    if (!data.transport) {
      return <>N/A</>;
    }
    const settings: any = data.transportSettings[data.transport];
    const settingKeys = settings ? (Object.keys(settings) as whatever[]) : [];
    return (
      <Grid item container xs={12} direction="column">
        {settingKeys.map((key, index: number) => {
          if (data.transport === 'smtp' && key === 'auth') {
            return Object.keys(settings['auth']).map((authItem: any, index: number) => {
              const settingsKey = settings['auth'];
              return (
                <Box key={`${authItem}${index}`}>
                  <TextField
                    required
                    id={authItem}
                    label={authItem}
                    variant="outlined"
                    className={classes.input}
                    value={settingsKey[authItem]}
                    onChange={(event) =>
                      handleChange(event.target.value, key, data.transport, authItem)
                    }
                  />
                </Box>
              );
            });
          }
          return (
            <Box key={index}>
              <TextField
                required
                id={key}
                label={key}
                variant="outlined"
                className={classes.input}
                value={settings[key] ? settings[key] : ''}
                onChange={(event) => handleChange(event.target.value, key, data.transport)}
              />
            </Box>
          );
        })}
      </Grid>
    );
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant={'h6'}>Transport settings</Typography>
      </Grid>
      {handleFields()}
    </>
  );
};

export default TransportSettings;
