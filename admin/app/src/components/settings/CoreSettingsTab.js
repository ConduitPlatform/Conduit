import { makeStyles } from '@material-ui/core/styles';
import React, { useState } from 'react';
import { Grid, Container, Select, Input, Switch, Button } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';

import { useDispatch } from 'react-redux';

const useStyles = makeStyles(() => ({
  textSpacing: {
    marginRight: 12,
    fontWeight: 'bold',
  },
}));

const selectOptions = [
  { value: 'development', title: 'development' },
  { value: 'production', title: 'production' },
  { value: 'test', title: 'test' },
];

const initialStates = {
  selectedEnum: 'development',
  url: 'http://localhost',
  port: 8080,
  toggleRest: true,
  toggleGraphQL: true,
};

const CoreSettingsTab = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [selectedEnum, setSelectedEnum] = useState(initialStates.selectedEnum);
  const [url, setUrl] = useState(initialStates.url);
  const [port, setPort] = useState(initialStates.port);
  const [toggleRest, setToggleRest] = useState(initialStates.toggleRest);
  const [toggleGraphQL, setToggleGraphQL] = useState(initialStates.toggleGraphQL);

  const onSelectChange = (event) => {
    setSelectedEnum(event.target.value);
  };

  const resetFields = () => {
    setSelectedEnum(initialStates.selectedEnum);
    setUrl(initialStates.url);
    setPort(initialStates.port);
    setToggleRest(initialStates.toggleRest);
    setToggleGraphQL(initialStates.toggleGraphQL);
  };

  const onSaveClick = () => {
    const data = {
      port: port,
      hostUrl: url,
      rest: toggleRest,
      graphql: toggleGraphQL,
      env: selectedEnum,
    };
    //dispatch(putCoreSettings(data));
    //console.log(data);
  };

  return (
    <Container>
      <Grid container justify={'center'}>
        <Grid item xs={12}>
          <Typography variant={'h6'}>Core settings</Typography>
          <Typography variant={'subtitle1'}>
            Below you can see information about the Conduit location
          </Typography>
        </Grid>
        <Grid item xs={12} container alignItems={'center'}>
          <Typography variant={'subtitle2'} className={classes.textSpacing}>
            Environment:
          </Typography>
          <Select value={selectedEnum} onChange={onSelectChange} native>
            {selectOptions.map((option, i) => (
              <option key={i} value={option.value}>
                {option.title}
              </option>
            ))}
          </Select>
        </Grid>
        <Grid item xs={12} style={{ marginTop: 16 }} container wrap={'nowrap'}>
          <Grid
            item
            xs={8}
            sm={4}
            container
            alignItems={'center'}
            wrap={'nowrap'}
            style={{ marginRight: 32 }}>
            <Typography
              component={'span'}
              variant={'subtitle2'}
              className={classes.textSpacing}>
              Url:
            </Typography>
            <Input
              fullWidth
              value={url}
              placeholder={'URL'}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Grid>
          <Grid item container alignItems={'center'} wrap={'nowrap'}>
            <Typography
              component={'span'}
              variant={'subtitle2'}
              className={classes.textSpacing}>
              Port:
            </Typography>

            <Input
              value={port}
              placeholder={'PORT'}
              type={'number'}
              onChange={(e) => setPort(e.target.value)}
            />
          </Grid>
        </Grid>
        <Grid item xs={12} style={{ marginTop: 32 }}>
          <Typography variant={'h6'}>Transport section</Typography>
        </Grid>
        <Grid item xs={12} container alignItems={'center'}>
          <Typography variant={'subtitle1'}>Toggle Rest:</Typography>
          <Switch
            checked={toggleRest}
            onChange={() => setToggleRest(!toggleRest)}
            color="primary"
            name="checkedRest"
          />
        </Grid>
        <Grid item xs={12} container alignItems={'center'}>
          <Typography variant={'subtitle1'}>Toggle GraphQL:</Typography>
          <Switch
            checked={toggleGraphQL}
            onChange={() => setToggleGraphQL(!toggleGraphQL)}
            color="primary"
            name="checkedGraphQL"
          />
        </Grid>
        <Grid item xs={12} style={{ marginTop: 32 }}>
          <Button
            style={{ marginRight: 32 }}
            placeholder={'Cancel'}
            onClick={resetFields}
            variant={'contained'}>
            Cancel
          </Button>
          <Button
            disabled={!url || !port || !selectedEnum}
            placeholder={'Save'}
            variant={'contained'}
            color={'primary'}
            onClick={onSaveClick}>
            Save
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default CoreSettingsTab;
