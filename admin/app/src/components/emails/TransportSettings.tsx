import React from 'react';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EmailSettings, whatever } from '../../models/emails/EmailModels';

const useStyles = makeStyles((theme) => ({
  input: {
    marginBottom: theme.spacing(2),
  },
}));

interface Props {
  data: EmailSettings;
  onChange: any;
}

const TransportSettings: React.FC<Props> = ({ data, onChange }) => {
  const classes = useStyles();
  const handleFields = () => {
    if (!data.transport) {
      return <>N/A</>;
    }
    const settings: any = data.transportSettings[data.transport];
    const settingKeys = settings ? (Object.keys(settings) as whatever[]) : [];
    return (
      <Grid item container xs={12} direction="column">
        {settingKeys.map((key, index: number) => {
          return (
            <Box key={index}>
              <TextField
                required
                id={key}
                label={key}
                variant="outlined"
                className={classes.input}
                value={settings[key] ? settings[key] : ''}
                // onChange={(event) => {
                //   setSettingsState({
                //     ...settingsState,
                //     transportSettings: {
                //       ...settingsState.transportSettings,
                //       apiKey: event.target.value,
                //     },
                //   });
                // }}
              />
            </Box>
          );
        })}
        {/*{data.transport === 'smtp' && (*/}
        {/*  <>*/}
        {/*    <Typography className={classes.input}>Authentication</Typography>*/}
        {/*    {transportProviderExtraFields['smtp'].auth.map((item, index) => {*/}
        {/*      return (*/}
        {/*        <Box key={index}>*/}
        {/*          <TextField*/}
        {/*            required*/}
        {/*            id={item.value}*/}
        {/*            label={item.label}*/}
        {/*            variant="outlined"*/}
        {/*            className={classes.input}*/}
        {/*            // value={settingsState.transportSettings.apiKey}*/}
        {/*            // onChange={(event) => {*/}
        {/*            //   setSettingsState({*/}
        {/*            //     ...settingsState,*/}
        {/*            //     transportSettings: {*/}
        {/*            //       ...settingsState.transportSettings,*/}
        {/*            //       apiKey: event.target.value,*/}
        {/*            //     },*/}
        {/*            //   });*/}
        {/*            // }}*/}
        {/*          />*/}
        {/*        </Box>*/}
        {/*      );*/}
        {/*    })}*/}
        {/*  </>*/}
        {/*)}*/}
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
