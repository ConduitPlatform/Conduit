import {
  Box,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
  FormControl,
  InputLabel,
  Select,
  Button,
  TextField,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import React, { useState } from 'react';

const useStyles = makeStyles((theme) => ({
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderRight: '1px solid #000000',
    height: '100%',
  },
  divider: {
    '&.MuiDivider-root': {
      height: '2px',
      background: '#000000',
      borderRadius: '4px',
    },
  },
  mainContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  button: {
    margin: theme.spacing(1),
    textTransform: 'none',
  },
  grid: {
    background: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    padding: theme.spacing(3),
  },
  listItem: {
    '&.MuiListItem-root:hover': {
      background: 'rgba(0, 83, 156, 0.2)',
      borderRadius: '4px',
    },
    '&.Mui-selected': {
      background: '#00539C',
      borderRadius: '4px',
      color: '#ffffff',
    },
    '&.Mui-selected:hover': {
      background: '#00539C',
      borderRadius: '4px',
      color: '#ffffff',
    },
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 180,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
  list: {
    '&.MuiList-root': {
      maxHeight: '580px',
      overflowY: 'auto',
      width: '100%',
      //   '&::-webkit-scrollbar': {
      //     display: 'none',
      //   },
    },
  },
}));

const CustomQueries = ({ endpoints = [], availableSchemas = [] }) => {
  const classes = useStyles();

  const [selectedEndpoint, setSelectedEndpoint] = useState();
  const [selectedOperation, setSelectedOperation] = useState();
  const [name, setName] = useState('');

  const handleListItemSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
  };

  const handleOperationChange = () => {};

  const handleNameChange = (value) => {
    setName(value);
  };

  const renderSideList = () => {
    return (
      <Box className={classes.listBox}>
        <Button variant="contained" color={'primary'} className={classes.button} endIcon={<AddCircleOutlineIcon />}>
          Add endpoint
        </Button>
        <Divider flexItem variant="middle" className={classes.divider}></Divider>
        <List className={classes.list}>
          {endpoints.map((endpoint) => (
            <ListItem
              button
              key={`endpoint-${endpoint.id}`}
              className={classes.listItem}
              onClick={() => handleListItemSelect(endpoint)}
              selected={selectedEndpoint?.id === endpoint?.id}>
              <ListItemText primary={endpoint.name} />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderOperationSection = () => {
    return (
      <>
        <Grid item xs={6}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Select Operation</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              labelWidth={100}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={'find/get'}>Find/Get</option>
              <option value={'create'}>Create</option>
              <option value={'update/edit'}>Update/Edit</option>
              <option value={'delete'}>Delete</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Select Schema</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              {availableSchemas.map((schema) => (
                <option key={`schema-${schema.id}`} value={schema.id}>
                  {schema.name}
                </option>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </>
    );
  };

  const renderInputsList = () => {
    return (
      <>
        <Grid item xs={1}>
          <Typography>1.</Typography>
        </Grid>
        <Grid item xs={3}>
          <TextField></TextField>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Select Schema</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={10}>Schema 1</option>
              <option value={20}>Schema 2</option>
              <option value={30}>Schema 3</option>
              <option value={30}>Schema 4</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Select Schema</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={10}>Schema 1</option>
              <option value={20}>Schema 2</option>
              <option value={30}>Schema 3</option>
              <option value={30}>Schema 4</option>
            </Select>
          </FormControl>
        </Grid>
      </>
    );
  };

  const renderQueryOptions = () => {
    return (
      <>
        <Grid item xs={1}>
          <Typography>1.</Typography>
        </Grid>
        <Grid item xs={3}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Select Field</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={10}>Username</option>
              <option value={20}>Email</option>
              <option value={30}>Role</option>
              <option value={30}>Age</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Add Condition</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={'equal-to'}>(==) equal to</option>
              <option value={'not-equal-to'}>(!=) not equal to</option>
              <option value={'equal-to'}>(==) equal to</option>
              <option value={'greater-than'}>{'(>) greater than'}</option>
              <option value={'greater-that-or-equal-to'}>{'(>=) greater that or equal to'}</option>
              <option value={'less than'}>{'(<) less than'}</option>
              <option value={'less-that-or-equal-to'}>{'(<=) less that or equal to'}</option>
              <option value={'equal-to-any-of-the-following'}>(in) equal to any of the following</option>
              <option value={'not-equal-to-any-of-the-following'}>(not-in) not equal to any of the following</option>
              <option value={'an-array-containing'}>(array-contains) an array containing</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="age-native-simple">Comparison Field</InputLabel>
            <Select
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              inputProps={{
                name: 'age',
                id: 'age-native-simple',
              }}>
              <option aria-label="None" value="" />
              <option value={10}>Custom</option>
              <option value={20}>Schema Fields</option>
              <option value={30}>Input Fields</option>
            </Select>
          </FormControl>
        </Grid>
      </>
    );
  };

  const renderSaveSection = () => {
    return (
      <Grid container justify="flex-end" spacing={1}>
        <Grid item xs={4} md={2}>
          <Button variant="contained" color="secondary">
            Cancel
          </Button>
        </Grid>
        <Grid item xs={4} md={2}>
          <Button variant="contained" color="primary">
            Save
          </Button>
        </Grid>
      </Grid>
    );
  };

  const renderMainContent = () => {
    if (!selectedEndpoint) {
      return (
        <Box className={classes.mainContent}>
          <Typography>Select an endpoint to view more</Typography>
        </Box>
      );
    } else {
      return (
        <Box>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <TextField label={'Name'} value={name} onChange={handleNameChange}></TextField>
            </Grid>
            {renderOperationSection()}
            <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
              <Typography>Inputs</Typography>
            </Grid>
            <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
              <Button variant="text" color={'primary'} className={classes.button} startIcon={<AddCircleOutlineIcon />}>
                Add another
              </Button>
            </Grid>
            <Grid item xs={12} style={{ padding: '0' }}>
              <Divider></Divider>
            </Grid>
            {renderInputsList()}
            <Grid item xs={12} style={{ padding: '0' }}>
              <Divider></Divider>
            </Grid>
            <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
              <Typography>Query</Typography>
            </Grid>
            <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
              <Button variant="text" color={'primary'} className={classes.button} startIcon={<AddCircleOutlineIcon />}>
                Add another
              </Button>
            </Grid>
            <Grid item xs={12} style={{ padding: '0' }}>
              <Divider></Divider>
            </Grid>
            {renderQueryOptions()}
            {renderSaveSection()}
          </Grid>
        </Box>
      );
    }
  };

  return (
    <Container>
      <Grid container spacing={2} className={classes.grid}>
        <Grid item xs={2}>
          {renderSideList()}
        </Grid>
        <Grid item xs={10}>
          {renderMainContent()}
        </Grid>
      </Grid>
    </Container>
  );
};

export default CustomQueries;
