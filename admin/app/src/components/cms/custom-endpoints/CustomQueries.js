import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import React, { useCallback, useEffect, useState } from 'react';
import OperationsEnum from '../../../models/OperationsEnum';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import EndpointAssignments from './EndpointAssignments';
import EndpointInputs from './EndpointInputs';
import EndpointQueries from './EndpointQueries';
import OperationSection from './OperationSection';
import Sidelist from './Sidelist';

const useStyles = makeStyles((theme) => ({
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
  selectEmpty: {
    marginTop: theme.spacing(2),
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

  const [name, setName] = useState('');
  const [selectedOperation, setSelectedOperation] = useState();
  const [selectedSchema, setSelectedSchema] = useState();
  const [authentication, setAuthentication] = useState(false);
  const [selectedInputs, setSelectedInputs] = useState([]);
  const [selectedQueries, setSelectedQueries] = useState([]);
  const [selectedAssignments, setSelectedAssignments] = useState([]);
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
        return {};
      }
    },
    [availableSchemas]
  );

  const initializeData = useCallback(() => {
    if (selectedEndpoint) {
      setName(selectedEndpoint.name);
      setSelectedOperation(selectedEndpoint.operation);
      setSelectedSchema(selectedEndpoint.selectedSchema);
      if (selectedEndpoint.authentication)
        setAuthentication(selectedEndpoint.authentication);

      const fields = getAvailableFieldsOfSchema(selectedEndpoint.selectedSchema);
      if (fields) {
        setAvailableFieldsOfSchema(Object.keys(fields));
      }

      if (selectedEndpoint.queries) {
        const queries = selectedEndpoint.queries.map((q) => ({ ...q }));
        setSelectedQueries(queries);
      }
      if (selectedEndpoint.assignments) {
        const assignments = selectedEndpoint.assignments.map((q) => ({ ...q }));
        setSelectedAssignments(assignments);
      }
      if (selectedEndpoint.inputs) {
        const inputs = selectedEndpoint.inputs.map((i) => ({ ...i }));
        setSelectedInputs(inputs);
      }
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
    const schema = availableSchemas.find((schema) => schema._id === selectedSchema);
    const data = {
      name: name,
      operation: Number(selectedOperation),
      selectedSchema: schema._id,
      authentication: authentication,
      inputs: selectedInputs,
      queries: selectedQueries,
      assignments: selectedAssignments,
    };
    handleCreate(data);
    setSelectedEndpoint(undefined);
    setCreateMode(false);
    setEditMode(false);
  };

  const handleSaveClick = () => {
    const schema = availableSchemas.find((schema) => schema._id === selectedSchema);
    const data = {
      name: name,
      operation: Number(selectedOperation),
      selectedSchema: schema._id,
      authentication: authentication,
      inputs: selectedInputs,
      queries: selectedQueries,
      assignments: selectedAssignments,
    };
    const _id = selectedEndpoint._id;
    handleEdit(_id, data);
    setSelectedEndpoint(undefined);
    setCreateMode(false);
    setEditMode(false);
  };

  const handleCancelClick = () => {
    setCreateMode(false);
    setEditMode(false);
    initializeData();
  };

  const handleDeleteConfirmed = () => {
    handleConfirmationDialogClose();
    setSelectedEndpoint(undefined);
    handleDelete(selectedEndpoint._id);
  };

  const handleListItemSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
  };

  const handleOperationChange = (event) => {
    setSelectedOperation(Number(event.target.value));
    if (Number(event.target.value) === 1) {
      if (selectedSchema) {
        if (availableFieldsOfSchema.length > 0) {
          let assignments = [];
          availableFieldsOfSchema.forEach((field) => {
            const assignment = {
              schemaField: field,
              action: 0,
              assignmentField: { type: '', value: '' },
            };
            assignments.push(assignment);
          });
          setSelectedAssignments(assignments);
        }
      }
    } else {
      setSelectedAssignments([]);
    }
  };

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleAddNewEndpoint = () => {
    setSelectedEndpoint(undefined);
    setEditMode(true);
    setCreateMode(true);
    setName('');
    setAuthentication(false);
    setSelectedOperation(-1);
    setSelectedSchema('');
    setSelectedInputs([]);
    setSelectedQueries([]);
  };

  const handleSchemaChange = (event) => {
    setSelectedSchema(event.target.value);
    const fields = getAvailableFieldsOfSchema(event.target.value);
    setAvailableFieldsOfSchema(Object.keys(fields));
    if (selectedOperation && selectedOperation === OperationsEnum.POST) {
      const fieldKeys = Object.keys(fields);
      let assignments = [];
      fieldKeys.forEach((field) => {
        const assignment = {
          schemaField: field,
          action: 0,
          assignmentField: { type: '', value: '' },
        };
        assignments.push(assignment);
      });
      setSelectedAssignments(assignments);
    } else {
      setSelectedAssignments([]);
    }
  };

  const handleAuthenticationChange = (event) => {
    setAuthentication(event.target.checked);
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
      input.location = Number(value);
      setSelectedInputs(currentInputs);
    }
  };

  const handleRemoveInput = (index) => {
    const input = selectedInputs[index];
    const currentInputs = selectedInputs.slice();
    currentInputs.splice(index, 1);

    const updatedQueries = selectedQueries.slice().map((q) => {
      const comparisonField = q.comparisonField;
      if (comparisonField.name === input.value) {
        return {
          ...q,
          comparisonField: {
            type: '',
            value: '',
          },
        };
      } else {
        return q;
      }
    });
    const updatedAssignments = selectedAssignments.slice().map((a) => {
      const assignmentField = a.assignmentField;
      if (assignmentField.name === input.value) {
        return {
          ...a,
          assignmentField: {
            type: '',
            value: '',
          },
        };
      } else {
        return a;
      }
    });
    setSelectedInputs(currentInputs);
    setSelectedQueries(updatedQueries);
    setSelectedAssignments(updatedAssignments);
  };

  const handleAddInput = () => {
    const input = {
      name: '',
      type: '',
      location: -1,
    };
    setSelectedInputs([...selectedInputs, input]);
  };

  const handleAddQuery = () => {
    const query = {
      schemaField: '',
      operation: -1,
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
      input.operation = Number(value);
      setSelectedQueries(currentQueries);
    }
  };

  const handleRemoveQuery = (index) => {
    const currentQueries = selectedQueries.slice();
    currentQueries.splice(index, 1);
    setSelectedQueries(currentQueries);
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

  const handleAddAssignment = () => {
    const assignment = {
      schemaField: '',
      action: 0,
      assignmentField: { type: '', value: '' },
    };
    setSelectedAssignments([...selectedAssignments, assignment]);
  };

  const handleAssignmentFieldChange = (event, index) => {
    const value = event.target.value;
    const currentAssignments = selectedAssignments.slice();
    const input = currentAssignments[index];
    if (input) {
      input.schemaField = value;
      setSelectedAssignments(currentAssignments);
    }
  };

  const handleAssignmentActionChange = (event, index) => {
    const value = event.target.value;
    const currentAssignments = selectedAssignments.slice();
    const input = currentAssignments[index];
    if (input) {
      input.action = Number(value);
      setSelectedAssignments(currentAssignments);
    }
  };

  const handleAssignmentValueFieldChange = (event, index) => {
    const value = event.target.value;

    const type = value.split('-')[0];
    const actualValue = value.split('-')[1];

    const currentAssignments = selectedAssignments.slice();
    const assignment = currentAssignments[index];
    if (assignment) {
      assignment.assignmentField.type = type;
      assignment.assignmentField.value = actualValue ? actualValue : '';
      setSelectedAssignments(currentAssignments);
    }
  };

  const handleAssignmentCustomValueChange = (event, index) => {
    const value = event.target.value;
    const currentAssignments = selectedAssignments.slice();
    const assignment = currentAssignments[index];
    if (assignment) {
      assignment.assignmentField.value = value;
      setSelectedAssignments(currentAssignments);
    }
  };

  const handleRemoveAssignment = (index) => {
    const currentAssignments = selectedAssignments.slice();
    currentAssignments.splice(index, 1);
    setSelectedAssignments(currentAssignments);
  };

  const disableSubmit = () => {
    if (!name) return true;
    if (!selectedSchema) return true;
    if (selectedOperation === -1) return true;

    let invalidQueries;
    let invalidAssignments;

    if (selectedOperation === OperationsEnum.POST) {
      if (!selectedAssignments || selectedAssignments.length === 0) return true;
      invalidAssignments = selectedAssignments.some(
        (assignment) =>
          assignment.schemaField === '' ||
          assignment.action === -1 ||
          assignment.assignmentField.type === '' ||
          assignment.assignmentField.value === ''
      );
    }
    if (selectedOperation === OperationsEnum.PUT) {
      if (!selectedQueries || selectedQueries.length === 0) return true;
      invalidQueries = selectedQueries.some(
        (query) =>
          query.schemaField === '' ||
          query.operation === -1 ||
          query.comparisonField.type === '' ||
          query.comparisonField.value === ''
      );
      if (!selectedAssignments || selectedAssignments.length === 0) return true;
      invalidAssignments = selectedAssignments.some(
        (assignment) =>
          assignment.schemaField === '' ||
          assignment.action === -1 ||
          assignment.assignmentField.type === '' ||
          assignment.assignmentField.value === ''
      );
    }
    if (selectedOperation === OperationsEnum.DELETE) {
      if (!selectedQueries || selectedQueries.length === 0) return true;
      invalidQueries = selectedQueries.some(
        (query) =>
          query.schemaField === '' ||
          query.operation === -1 ||
          query.comparisonField.type === '' ||
          query.comparisonField.value === ''
      );
    }
    if (selectedOperation === OperationsEnum.GET) {
      if (!selectedQueries || selectedQueries.length === 0) return true;
      invalidQueries = selectedQueries.some(
        (query) =>
          query.schemaField === '' ||
          query.operation === -1 ||
          query.comparisonField.type === '' ||
          query.comparisonField.value === ''
      );
    }

    if (invalidQueries || invalidAssignments) {
      return true;
    }
    const invalidInputs = selectedInputs.some(
      (input) => input.name === '' || input.type === '' || input.location === -1
    );
    if (invalidInputs) {
      return true;
    }
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
            disabled={disableSubmit()}
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
            <OperationSection
              availableSchemas={availableSchemas}
              selectedSchema={selectedSchema}
              selectedOperation={selectedOperation}
              editMode={editMode}
              handleOperationChange={handleOperationChange}
              handleSchemaChange={handleSchemaChange}
              authentication={authentication}
              handleAuthenticationChange={handleAuthenticationChange}
            />
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
            <EndpointInputs
              selectedInputs={selectedInputs}
              editMode={editMode}
              handleInputNameChange={handleInputNameChange}
              handleInputTypeChange={handleInputTypeChange}
              handleInputLocationChange={handleInputLocationChange}
              handleRemoveInput={handleRemoveInput}
            />
            <Grid item xs={12} style={{ padding: '0' }}>
              <Divider></Divider>
            </Grid>
            {selectedOperation !== OperationsEnum.POST && (
              <>
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
                <EndpointQueries
                  selectedQueries={selectedQueries}
                  availableFieldsOfSchema={availableFieldsOfSchema}
                  selectedInputs={selectedInputs}
                  editMode={editMode}
                  handleQueryFieldChange={handleQueryFieldChange}
                  handleQueryComparisonFieldChange={handleQueryComparisonFieldChange}
                  handleCustomValueChange={handleCustomValueChange}
                  handleQueryConditionChange={handleQueryConditionChange}
                  handleRemoveQuery={handleRemoveQuery}
                />
              </>
            )}
            {(selectedOperation === OperationsEnum.PUT ||
              selectedOperation === OperationsEnum.POST) && (
              <>
                <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
                  <Typography>Assigments</Typography>
                </Grid>
                <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
                  <Button
                    disabled={!editMode}
                    variant="text"
                    color={'primary'}
                    className={classes.button}
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddAssignment}>
                    Add another
                  </Button>
                </Grid>
                <Grid item xs={12} style={{ padding: '0' }}>
                  <Divider></Divider>
                </Grid>
                <EndpointAssignments
                  selectedAssignments={selectedAssignments}
                  editMode={editMode}
                  availableFieldsOfSchema={availableFieldsOfSchema}
                  selectedInputs={selectedInputs}
                  handleAssignmentFieldChange={handleAssignmentFieldChange}
                  handleAssignmentActionChange={handleAssignmentActionChange}
                  handleAssignmentValueFieldChange={handleAssignmentValueFieldChange}
                  handleAssignmentCustomValueChange={handleAssignmentCustomValueChange}
                  handleRemoveAssignment={handleRemoveAssignment}
                />
              </>
            )}

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
          <Sidelist
            endpoints={endpoints}
            selectedEndpoint={selectedEndpoint}
            handleAddNewEndpoint={handleAddNewEndpoint}
            handleListItemSelect={handleListItemSelect}
          />
        </Grid>
        <Grid item xs={10}>
          {renderMainContent()}
        </Grid>
      </Grid>
      <ConfirmationDialog
        open={confirmationOpen}
        title={'Custom Endpoint Deletion'}
        description={`You are about to 
        delete custom endpoint with name:${selectedEndpoint?.name}`}
        buttonText={'Delete'}
        handleClose={handleConfirmationDialogClose}
        buttonAction={handleDeleteConfirmed}
      />
    </Container>
  );
};

export default CustomQueries;
