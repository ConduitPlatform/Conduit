import React, { FC } from 'react';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { IStorageConfig } from '../../models/storage/StorageModels';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  input: {
    marginBottom: theme.spacing(2),
  },
}));

interface Props {
  data: IStorageConfig;
  onChange: (data: IStorageConfig) => void;
}

const StorageProviderSettings: FC<Props> = ({ data, onChange }) => {
  const classes = useStyles();
  const handleFields = () => {
    switch (data.provider) {
      case 'azure':
        return (
          <Grid item xs={6}>
            <TextField
              type="text"
              label="connectionString"
              variant="outlined"
              fullWidth
              value={data.azure.connectionString}
              onChange={(event) => {
                onChange({
                  ...data,
                  azure: {
                    ...data.azure,
                    connectionString: event.target.value,
                  },
                });
              }}
            />
          </Grid>
        );
      case 'google':
        return (
          <Grid item container xs={6}>
            <Grid item xs={12}>
              <TextField
                type="text"
                label="Account key path"
                variant="outlined"
                fullWidth
                value={data.google.serviceAccountKeyPath}
                className={classes.input}
                onChange={(event) => {
                  onChange({
                    ...data,
                    google: {
                      ...data.google,
                      serviceAccountKeyPath: event.target.value,
                    },
                  });
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                type="text"
                label="Bucket name"
                variant="outlined"
                fullWidth
                value={data.google.serviceAccountKeyPath}
                onChange={(event) => {
                  onChange({
                    ...data,
                    google: {
                      ...data.google,
                      serviceAccountKeyPath: event.target.value,
                    },
                  });
                }}
              />
            </Grid>
          </Grid>
        );
      default:
        return <></>;
    }
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
export default StorageProviderSettings;
