import { Box, Grid, IconButton, TextField, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import React, { FC, useCallback, useEffect, useState } from 'react';
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
import QueriesSection from './QueriesSection';
import AssignmentsSection from './AssignmentsSection';
import InputsSection from './InputsSection';
import { v4 as uuidv4 } from 'uuid';
import {
  endpointCleanSlate,
  setEndpointData,
  setSchemaFields,
  setSelectedEndPoint,
} from '../../../redux/slices/customEndpointsSlice';
import { Schema } from '../../../models/cms/CmsModels';
import { useAppDispatch, useAppSelector } from '../../../redux/store';

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

interface Props {
  handleCreate: any;
  handleEdit: any;
  handleDelete: any;
}

const CustomQueries: FC<Props> = ({ handleCreate, handleEdit, handleDelete }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const { schemas, customEndpoints } = useAppSelector((state) => state.cmsSlice.data);

  const { endpoint, selectedEndpoint } = useAppSelector(
    (state) => state.customEndpointsSlice.data
  );

  console.log('selectedEndpoint:', selectedEndpoint);

  const initializeData = useCallback(() => {
    if (selectedEndpoint) {
      const fields = getAvailableFieldsOfSchema(selectedEndpoint.selectedSchema, schemas);
      let inputs = [];
      const queryGroup: any = [];
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
          const nodeLevel1Queries = nodeLevel1.map((q: any) => {
            const keys = Object.keys(q);
            const isOperator = keys.includes('AND') || keys.includes('OR');
            if (isOperator) {
              return { _id: uuidv4(), operator: keys[0], queries: q[keys[0]] };
            } else {
              return { _id: uuidv4(), ...q };
            }
          });

          const lvl2Node = nodeLevel1Queries.find((q: any) => 'operator' in q);
          if (lvl2Node) {
            const nodeLevel2Queries = lvl2Node.queries.map((q: any) => {
              const keys = Object.keys(q);
              const isOperator = keys.includes('AND') || keys.includes('OR');
              if (isOperator) {
                return { _id: uuidv4(), operator: keys[0], queries: q[keys[0]] };
              } else {
                return { _id: uuidv4(), ...q };
              }
            });
            lvl2Node.queries = [...nodeLevel2Queries];

            const lvl3Node = nodeLevel2Queries.find((q: any) => 'operator' in q);
            if (lvl3Node) {
              const nodeLevel3Queries = lvl3Node.queries.map((q: any) => ({
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
      }

      if (selectedEndpoint.assignments) {
        assignments = selectedEndpoint.assignments.map((q: any) => ({ ...q }));
      }
      if (selectedEndpoint.inputs) {
        inputs = selectedEndpoint.inputs.map((i: any) => ({ ...i }));
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
    const schema = schemas.find(
      (schema: Schema) => schema._id === endpoint.selectedSchema
    );

    const query = prepareQuery(endpoint.queries);

    const data = {
      name: endpoint.name,
      operation: Number(endpoint.operation),
      selectedSchema: schema?._id,
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
      dispatch(setSelectedEndPoint(''));
    } else {
      handleCreate(data);
      dispatch(setSelectedEndPoint(''));
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
    dispatch(setSelectedEndPoint(undefined));
    handleDelete(selectedEndpoint._id);
  };

  const handleListItemSelect = (endpoint: any) => {
    dispatch(setSelectedEndPoint(endpoint));
    dispatch(setEndpointData({ ...endpoint }));
  };

  const handleNameChange = (event: any) => {
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
