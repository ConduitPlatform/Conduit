import { Box, Grid, IconButton, TextField, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import React, { useCallback, useEffect, useState } from 'react';
import OperationsEnum from '../../../models/OperationsEnum';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import OperationSection from './OperationSection';
import SideList from './Sidelist';
import {
  findFieldsWithTypes,
  getAvailableFieldsOfSchema,
  hasInvalidAssignments,
  hasInvalidInputs,
  hasInvalidQueries,
  prepareQuery,
} from '../../../utils/cms';
import SaveSection from './SaveSection';
import { useDispatch, useSelector } from 'react-redux';
import {
  endpointCleanSlate,
  setEndpointData,
  setSchemaFields,
  setSelectedEndpoint,
} from '../../../redux/actions/customEndpointsActions';
import QueriesSection from './QueriesSection';
import AssignmentsSection from './AssignmentsSection';
import InputsSection from './InputsSection';
import { v4 as uuidv4 } from 'uuid';

const useStyles = makeStyles((theme) => ({
  root: {
    marginLeft: theme.spacing(4),
    marginRight: theme.spacing(4),
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
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
  textField: {
    width: '245px',
  },
}));

const CustomQueries = ({ handleCreate, handleEdit, handleDelete }) => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const {
    data: { schemas, customEndpoints },
  } = useSelector((state) => state.cmsReducer);

  const { endpoint, selectedEndpoint } = useSelector(
    (state) => state.customEndpointsReducer
  );

  const initializeData = useCallback(() => {
    if (selectedEndpoint) {
      const fields = getAvailableFieldsOfSchema(selectedEndpoint.selectedSchema, schemas);
      let inputs = [];
      let queryGroup = [];
      let assignments = [];
      let fieldsWithTypes = [];
      if (fields) {
        fieldsWithTypes = findFieldsWithTypes(fields);
      }

      if (selectedEndpoint.queries) {
        const query = selectedEndpoint.query;
        const keys = Object.keys(query);
        keys.forEach((k) => {
          const nodeLevel1 = query[k];
          const nodeLevel1Queries = nodeLevel1.map((q) => ({ _id: uuidv4(), ...q }));
          const lvl2Node = nodeLevel1Queries.find((q) => 'operator' in q);
          if (lvl2Node) {
            const nodeLevel2Queries = lvl2Node.queries.map((q) => ({
              _id: uuidv4(),
              ...q,
            }));
            lvl2Node.queries = [...nodeLevel2Queries];

            const lvl3Node = nodeLevel2Queries.find((q) => 'operator' in q);
            if (lvl3Node) {
              const nodeLevel3Queries = lvl3Node.queries.map((q) => ({
                _id: uuidv4(),
                ...q,
              }));
              lvl3Node.queries = [...nodeLevel3Queries];
            }
          }
          queryGroup.push({
            _id: uuidv4(),
            operator: k,
            queries: [...nodeLevel1Queries],
          });
        });
        // const queries = selectedEndpoint.queries.map((q) => ({ ...q }));
        console.log(queryGroup);
      }
      if (selectedEndpoint.assignments) {
        assignments = selectedEndpoint.assignments.map((q) => ({ ...q }));
      }
      if (selectedEndpoint.inputs) {
        inputs = selectedEndpoint.inputs.map((i) => ({ ...i }));
      }

      dispatch(
        setEndpointData({
          queries: queryGroup,
          inputs,
          assignments,
        })
      );
      dispatch(setSchemaFields(fieldsWithTypes));
    }
  }, [schemas, selectedEndpoint]);

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

  const handleSubmit = (edit = false) => {
    const schema = schemas.find((schema) => schema._id === endpoint.selectedSchema);

    const query = prepareQuery(endpoint.queries);

    const data = {
      name: endpoint.name,
      operation: Number(endpoint.operation),
      selectedSchema: schema._id,
      authentication: endpoint.authentication,
      paginated: endpoint.paginated,
      sorted: endpoint.sorted,
      inputs: endpoint.inputs,
      query,
      assignments: endpoint.assignments,
    };

    if (edit) {
      const _id = selectedEndpoint._id;
      handleEdit(_id, data);
      dispatch(setSelectedEndpoint(''));
    } else {
      handleCreate(data);
      dispatch(setSelectedEndpoint(''));
    }
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
    dispatch(setSelectedEndpoint(undefined));
    handleDelete(selectedEndpoint._id);
  };

  const handleListItemSelect = (endpoint) => {
    dispatch(setSelectedEndpoint(endpoint));
    dispatch(setEndpointData({ ...endpoint }));
  };

  const handleNameChange = (event) => {
    dispatch(setEndpointData({ name: event.target.value }));
  };

  const handleAddNewEndpoint = () => {
    dispatch(endpointCleanSlate());
    setEditMode(true);
    setCreateMode(true);
  };

  const disableSubmit = () => {
    if (!endpoint.name) return true;
    if (!endpoint.selectedSchema) return true;
    if (endpoint.operation === -1) return true;

    let invalidQueries;
    let invalidAssignments;

    if (endpoint.operation === OperationsEnum.POST) {
      if (!endpoint.assignments || endpoint.assignments.length === 0) return true;
      invalidAssignments = hasInvalidAssignments(endpoint.assignments);
    }
    if (endpoint.operation === OperationsEnum.PUT) {
      if (!endpoint.queries || endpoint.queries.length === 0) return true;
      invalidQueries = hasInvalidQueries(endpoint.queries);
      if (!endpoint.assignments || endpoint.assignments.length === 0) return true;
      invalidAssignments = hasInvalidAssignments(endpoint.assignments);
    }
    if (endpoint.operation === OperationsEnum.DELETE) {
      if (!endpoint.queries || endpoint.queries.length === 0) return true;
      invalidQueries = hasInvalidQueries(endpoint.queries);
    }
    if (endpoint.operation === OperationsEnum.GET) {
      if (!endpoint.queries || endpoint.queries.length === 0) return true;
      invalidQueries = hasInvalidQueries(endpoint.queries);
    }

    if (invalidQueries || invalidAssignments) {
      return true;
    }
    const invalidInputs = hasInvalidInputs(endpoint.inputs);
    if (invalidInputs) {
      return true;
    }
  };

  const renderSaveSection = () => {
    if (!editMode && !createMode) {
      return null;
    }

    return (
      <SaveSection
        editMode={editMode}
        createMode={createMode}
        disableSubmit={disableSubmit()}
        handleSaveClick={() => handleSubmit(true)}
        handleCreateClick={() => handleSubmit(false)}
        handleCancelClick={handleCancelClick}
      />
    );
  };

  const renderDetails = () => {
    if (!endpoint.selectedSchema || endpoint.operation === -1) return null;
    return (
      <>
        <InputsSection editMode={editMode} />
        {endpoint.operation !== OperationsEnum.POST && (
          <QueriesSection editMode={editMode} />
        )}
        {(endpoint.operation === OperationsEnum.PUT ||
          endpoint.operation === OperationsEnum.POST) && (
          <AssignmentsSection editMode={editMode} />
        )}
      </>
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
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={7}>
              <TextField
                disabled={!editMode}
                variant={'outlined'}
                className={classes.textField}
                label={'Name'}
                value={endpoint.name}
                onChange={handleNameChange}
              />
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
              schemas={schemas}
              editMode={editMode}
              availableSchemas={schemas}
            />
            {renderDetails()}
            {renderSaveSection()}
          </Grid>
        </Box>
      );
    }
  };

  return (
    <Box className={classes.root}>
      <Grid container spacing={2} className={classes.grid}>
        <Grid item xs={3}>
          <SideList
            endpoints={customEndpoints}
            selectedEndpoint={selectedEndpoint}
            handleAddNewEndpoint={handleAddNewEndpoint}
            handleListItemSelect={handleListItemSelect}
          />
        </Grid>
        <Grid item xs={9}>
          {renderMainContent()}
        </Grid>
      </Grid>
      <ConfirmationDialog
        buttonText={'Delete'}
        open={confirmationOpen}
        title={'Custom Endpoint Deletion'}
        description={`You are about to
        delete custom endpoint with name:${selectedEndpoint?.name}`}
        handleClose={handleConfirmationDialogClose}
        buttonAction={handleDeleteConfirmed}
      />
    </Box>
  );
};

export default CustomQueries;
