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
  IconButton,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import EditIcon from '@material-ui/icons/Edit';
import React, { Fragment, useEffect, useState, useCallback } from 'react';
import ConfirmationDialog from '../ConfirmationDialog';
import OperationsEnum from '../../models/OperationsEnum';
import ConditionsEnum from '../../models/ConditionsEnum';
import InputLocationEnum from '../../models/InputLocationEnum';

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
    background: 'rgba(0, 0, 0, 0.05)',
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
  textField: {
    width: '245px',
  },
}));

const CustomQueries = ({
  endpoints = [],
  availableSchemas = [],
  handleCreate,
  handleEdit,
  handleDelete,
}) => {
  const classes = useStyles();

  const [selectedEndpoint, setSelectedEndpoint] = useState();
  const [availableFieldsOfSchema, setAvailableFieldsOfSchema] = useState([]);

  /**
   * @description Custom endpoint data local state fields
   */
  const [name, setName] = useState('');
  const [selectedOperation, setSelectedOperation] = useState();
  const [selectedSchema, setSelectedSchema] = useState();
  const [selectedInputs, setSelectedInputs] = useState([]);
  const [selectedQueries, setSelectedQueries] = useState([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const getAvailableFieldsOfSchema = useCallback(
    (schemaSelected) => {
      if (schemaSelected) {
        const found = availableSchemas.find((schema) => schema._id === schemaSelected);
        if (found) {
          return found.fields;
        }
      }
    },
    [availableSchemas]
  );

  const initializeData = useCallback(() => {
    if (selectedEndpoint) {
      setName(selectedEndpoint.name);
      setSelectedOperation(selectedEndpoint.operation);
      setSelectedSchema(selectedEndpoint.schema);

      const fields = getAvailableFieldsOfSchema(selectedEndpoint.schema);
      setAvailableFieldsOfSchema(Object.keys(fields));

      const inputs = selectedEndpoint.inputs.map((i) => ({ ...i }));
      const queries = selectedEndpoint.queries.map((q) => ({ ...q }));
      setSelectedInputs(inputs);
      setSelectedQueries(queries);
    }
  }, [getAvailableFieldsOfSchema, selectedEndpoint]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const handleConfirmationDialogClose = () => {
    setConfirmationOpen(false);
  };

  const handleDeleteClick = () => {
    setConfirmationOpen(true);
  };

  const handleEditClick = () => {
    setEditMode(true);
    setCreateMode(false);
  };

  const handleCreateClick = () => {
    const data = {
      name: name,
      operaton: selectedOperation,
      schema: selectedSchema,
      inputs: selectedInputs,
      queries: selectedQueries,
    };
    handleCreate(data);
  };

  const handleSaveClick = () => {
    const data = {
      name: name,
      operaton: selectedOperation,
      schema: selectedSchema,
      inputs: selectedInputs,
      queries: selectedQueries,
    };
    const _id = selectedEndpoint._id;
    handleEdit(_id, data);
  };

  const handleCancelClick = () => {
    setCreateMode(false);
    setEditMode(false);
    initializeData();
  };

  const handleDeleteConfirmed = () => {
    handleConfirmationDialogClose();
    handleDelete(selectedEndpoint.id);
  };

  const handleListItemSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
  };

  const handleOperationChange = (event) => {
    setSelectedOperation(event.target.value);
  };

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleAddNewEndpoint = () => {
    setSelectedEndpoint(undefined);
    setEditMode(true);
    setCreateMode(true);
    setName('');
    setSelectedOperation(-1);
    setSelectedSchema('');
    setSelectedInputs([]);
    setSelectedQueries([]);
  };

  const handleSchemaChange = (event) => {
    setSelectedSchema(event.target.value);
    const fields = getAvailableFieldsOfSchema(event.target.value);
    setAvailableFieldsOfSchema(Object.keys(fields));
  };

  const handleInputNameChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.name = value;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputTypeChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.type = value;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputLocationChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.location = value;
      setSelectedInputs(currentInputs);
    }
  };

  const handleAddInput = () => {
    const input = {
      name: '',
      type: '',
      location: '',
    };
    setSelectedInputs([...selectedInputs, input]);
  };

  const handleAddQuery = () => {
    const query = {
      schemaField: '',
      operation: '',
      comparisonField: {
        type: '',
        value: '',
      },
    };
    setSelectedQueries([...selectedQueries, query]);
  };

  const handleQueryFieldChange = (event, index) => {
    const value = event.target.value;
    const currentQueries = selectedQueries.slice();
    const input = currentQueries[index];
    if (input) {
      input.schemaField = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryConditionChange = (event, index) => {
    const value = event.target.value;
    const currentQueries = selectedQueries.slice();
    const input = currentQueries[index];
    if (input) {
      input.operation = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryComparisonFieldChange = (event, index) => {
    const value = event.target.value;

    const type = value.split('-')[0];
    const actualValue = value.split('-')[1];

    const currentQueries = selectedQueries.slice();
    const query = currentQueries[index];
    if (query) {
      query.comparisonField.type = type;
      query.comparisonField.value = actualValue ? actualValue : '';
      setSelectedQueries(currentQueries);
    }
  };

  const handleCustomValueChange = (event, index) => {
    const value = event.target.value;
    const currentQueries = selectedQueries.slice();
    const query = currentQueries[index];
    if (query) {
      query.comparisonField.value = value;
      setSelectedQueries(currentQueries);
    }
  };

  const renderSideList = () => {
    return (
      <Box className={classes.listBox}>
        <Button
          variant="contained"
          color={'primary'}
          className={classes.button}
          endIcon={<AddCircleOutlineIcon />}
          onClick={handleAddNewEndpoint}>
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
            <InputLabel htmlFor="select_operation">Select Operation</InputLabel>
            <Select
              disabled={!editMode}
              native
              value={selectedOperation}
              onChange={handleOperationChange}
              labelWidth={100}
              inputProps={{
                name: 'select_operation',
                id: 'select_operation',
              }}>
              <option aria-label="None" value="" />
              <option value={OperationsEnum.GET}>Find/Get</option>
              <option value={OperationsEnum.POST}>Create</option>
              <option value={OperationsEnum.PUT}>Update/Edit</option>
              <option value={OperationsEnum.DELETE}>Delete</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="select_schema">Select Schema</InputLabel>
            <Select
              disabled={!editMode}
              native
              value={selectedSchema}
              onChange={handleSchemaChange}
              inputProps={{
                name: 'select_schema',
                id: 'select_schema',
              }}>
              <option aria-label="None" value="" />
              {availableSchemas.map((schema, index) => (
                <option
                  key={`schema-${schema.id ? schema.id : index}`}
                  value={schema._id}>
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
    return selectedInputs.map((input, index) => (
      <Fragment key={`input-${index}`}>
        <Grid item xs={1} key={index}>
          <Typography>{index + 1}.</Typography>
        </Grid>
        <Grid item xs={3}>
          <TextField
            disabled={!editMode}
            value={input.name}
            onChange={(event) => handleInputNameChange(event, index)}></TextField>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <InputLabel>Type</InputLabel>
            <Select
              disabled={!editMode}
              native
              value={input.type}
              onChange={(event) => handleInputTypeChange(event, index)}>
              <option aria-label="None" value="" />
              <option value={'String'}>String</option>
              <option value={'Number'}>Number</option>
              <option value={'Boolean'}>Boolean</option>
              <option value={'ObjectId'}>ObjectId</option>
              <option value={'Date'}>Date</option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <FormControl className={classes.formControl}>
            <Select
              disabled={!editMode}
              native
              value={input.location}
              onChange={(event) => handleInputLocationChange(event, index)}>
              <option aria-label="None" value="" />
              <option value={InputLocationEnum.QUERY_PARAMS}>Query params</option>
              <option value={InputLocationEnum.BODY}>Body</option>
              <option value={InputLocationEnum.URL_PARAMS}>Form Data</option>
            </Select>
          </FormControl>
        </Grid>
      </Fragment>
    ));
  };

  const renderQueryOptions = () => {
    return selectedQueries.map((query, index) => (
      <Fragment key={`query-${index}`}>
        <Grid item xs={1}>
          <Typography>{index + 1}.</Typography>
        </Grid>
        <Grid item xs={3}>
          <FormControl className={classes.formControl}>
            <Select
              fullWidth
              disabled={!editMode}
              native
              value={query.schemaField}
              onChange={(event) => handleQueryFieldChange(event, index)}>
              <option aria-label="None" value="" />
              {availableFieldsOfSchema.map((field, index) => (
                <option key={`idx-${index}-field`} value={field}>
                  {field}
                </option>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={3}>
          <FormControl className={classes.formControl}>
            <Select
              disabled={!editMode}
              native
              fullWidth
              value={query.operation}
              onChange={(event) => handleQueryConditionChange(event, index)}>
              <option aria-label="None" value="" />
              <option value={ConditionsEnum.EQUAL}>(==) equal to</option>
              <option value={ConditionsEnum.NEQUAL}>(!=) not equal to</option>
              <option value={ConditionsEnum.GREATER}>{'(>) greater than'}</option>
              <option value={ConditionsEnum.GREATER_EQ}>
                {'(>=) greater that or equal to'}
              </option>
              <option value={ConditionsEnum.LESS}>{'(<) less than'}</option>
              <option value={ConditionsEnum.LESS_EQ}>
                {'(<=) less that or equal to'}
              </option>
              <option value={ConditionsEnum.EQUAL_SET}>
                (in) equal to any of the following
              </option>
              <option value={ConditionsEnum.NEQUAL_SET}>
                (not-in) not equal to any of the following
              </option>
              <option value={ConditionsEnum.CONTAIN}>
                (array-contains) an array containing
              </option>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={3}>
          <FormControl className={classes.formControl}>
            <Select
              fullWidth
              disabled={!editMode}
              native
              value={
                query.comparisonField.type === 'Custom'
                  ? query.comparisonField.type
                  : query.comparisonField.type + '-' + query.comparisonField.value
              }
              onChange={(event) => handleQueryComparisonFieldChange(event, index)}>
              <option aria-label="None" value="" />
              <optgroup label="Custom Value">
                <option value={'Custom'}>Add a custom value</option>
              </optgroup>
              <optgroup label="Schema Fields">
                {availableFieldsOfSchema.map((field, index) => (
                  <option key={`idx-${index}-field`} value={'Schema-' + field}>
                    {field}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Input Fields">
                {selectedInputs.map((input, index) => (
                  <option key={`idx-${index}-input`} value={'Input-' + input.name}>
                    {input.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          </FormControl>
        </Grid>
        {query.comparisonField.type === 'Custom' && (
          <Grid item xs={2}>
            <TextField
              label={'Custom Value'}
              variant={'outlined'}
              disabled={!editMode}
              fullWidth
              placeholder={'Value'}
              value={query.comparisonField.value}
              onChange={(event) => handleCustomValueChange(event, index)}
            />
          </Grid>
        )}
      </Fragment>
    ));
  };

  const renderSaveSection = () => {
    if (!editMode && !createMode) {
      return null;
    }
    return (
      <Grid container justify="flex-end" spacing={1} style={{ paddingTop: '30px' }}>
        <Grid item xs={4} md={2}>
          <Button variant="contained" color="secondary" onClick={handleCancelClick}>
            Cancel
          </Button>
        </Grid>

        <Grid item xs={4} md={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={createMode ? handleCreateClick : editMode ? handleSaveClick : ''}>
            {createMode ? 'Create' : editMode ? 'Save' : ''}
          </Button>
        </Grid>
      </Grid>
    );
  };

  const renderMainContent = () => {
    if (!selectedEndpoint && !createMode) {
      return (
        <Box className={classes.mainContent}>
          <Typography>Select an endpoint to view more</Typography>
        </Box>
      );
    } else {
      return (
        <Box>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={7}>
              <TextField
                disabled={!editMode}
                variant={'outlined'}
                className={classes.textField}
                label={'Name'}
                value={name}
                onChange={handleNameChange}></TextField>
            </Grid>
            <Grid item xs={5} style={{ textAlign: 'end' }}>
              {!editMode && (
                <IconButton aria-label="delete" onClick={handleDeleteClick}>
                  <DeleteIcon />
                </IconButton>
              )}
              {!editMode && (
                <IconButton aria-label="edit" onClick={handleEditClick}>
                  <EditIcon />
                </IconButton>
              )}
            </Grid>
            {renderOperationSection()}
            <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
              <Typography>Inputs</Typography>
            </Grid>
            <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
              <Button
                disabled={!editMode}
                variant="text"
                color={'primary'}
                className={classes.button}
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAddInput}>
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
              <Button
                disabled={!editMode}
                variant="text"
                color={'primary'}
                className={classes.button}
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAddQuery}>
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
      <ConfirmationDialog
        open={confirmationOpen}
        title={'Custom Endpoint Deletion'}
        description={`You are about to delete custom endpoint with name:${selectedEndpoint?.name}`}
        buttonText={'Procceed'}
        handleClose={handleConfirmationDialogClose}
        buttonAction={handleDeleteConfirmed}
      />
    </Container>
  );
};

export default CustomQueries;
