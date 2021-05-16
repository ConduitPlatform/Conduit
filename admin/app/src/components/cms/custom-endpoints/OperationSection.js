import React from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  Select,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import OperationsEnum from '../../../models/OperationsEnum';
import { findFieldsWithTypes, getAvailableFieldsOfSchema } from '../../../utils/cms';
import { useDispatch, useSelector } from 'react-redux';
import {
  setEndpointData,
  setSchemaFields,
} from '../../../redux/actions/customEndpointsActions';

const useStyles = makeStyles((theme) => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 180,
  },
  divider: {
    '&.MuiDivider-root': {
      height: '2px',
      background: '#000000',
      borderRadius: '4px',
    },
  },
}));

const OperationSection = ({ schemas, editMode, availableSchemas }) => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const { endpoint, schemaFields } = useSelector((state) => state.customEndpointsReducer);

  const handleOperationChange = (event) => {
    const operation = Number(event.target.value);
    let assignments = [];
    if (operation === 1) {
      if (endpoint.selectedSchema) {
        if (schemaFields.length > 0) {
          schemaFields.forEach((field) => {
            const assignment = {
              schemaField: field,
              action: 0,
              assignmentField: { type: '', value: '' },
            };
            assignments.push(assignment);
          });
        }
      }
    }
    dispatch(setEndpointData({ operation, assignments }));
  };

  const handleSchemaChange = (event) => {
    let assignments = [];
    const selectedSchema = event.target.value;
    const fields = getAvailableFieldsOfSchema(selectedSchema, schemas);
    const fieldsWithTypes = findFieldsWithTypes(fields);
    if (endpoint.operation && endpoint.operation === OperationsEnum.POST) {
      const fieldKeys = Object.keys(fields);

      fieldKeys.forEach((field) => {
        const assignment = {
          schemaField: field,
          action: 0,
          assignmentField: { type: '', value: '' },
        };
        assignments.push(assignment);
      });
    }
    dispatch(setEndpointData({ selectedSchema, assignments }));
    dispatch(setSchemaFields(fieldsWithTypes));
  };

  const handleAuthenticationChange = (event) => {
    dispatch(setEndpointData({ authentication: event.target.checked }));
  };

  const handlePaginatedChange = (event) => {
    dispatch(setEndpointData({ paginated: event.target.checked }));
  };

  const handleSortedChange = (event) => {
    dispatch(setEndpointData({ sorted: event.target.checked }));
  };

  return (
    <>
      <Grid item xs={3}>
        <FormControl className={classes.formControl}>
          <InputLabel htmlFor="select_operation">Select Operation</InputLabel>
          <Select
            disabled={!editMode}
            native
            value={endpoint.operation}
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
      <Grid item xs={3}>
        <FormControl className={classes.formControl}>
          <InputLabel htmlFor="select_schema">Select Schema</InputLabel>
          <Select
            disabled={!editMode}
            native
            value={endpoint.selectedSchema}
            onChange={handleSchemaChange}
            inputProps={{
              name: 'select_schema',
              id: 'select_schema',
            }}>
            <option aria-label="None" value="" />
            {availableSchemas.map((schema, index) => (
              <option key={`schema-${index}`} value={schema._id}>
                {schema.name}
              </option>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={endpoint.operation === OperationsEnum.GET ? 2 : 4}>
        <FormControlLabel
          control={
            <Checkbox
              disabled={!editMode}
              color={'primary'}
              checked={endpoint.authentication}
              onChange={handleAuthenticationChange}
              name="authentication"
            />
          }
          label="Authenticated"
        />
      </Grid>
      {endpoint.operation === OperationsEnum.GET && (
        <Grid item xs={2}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={!editMode}
                color={'primary'}
                checked={endpoint.paginated}
                onChange={handlePaginatedChange}
                name="paginated"
              />
            }
            label="Paginated"
          />
        </Grid>
      )}
      {endpoint.operation === OperationsEnum.GET && (
        <Grid item xs={2}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={!editMode}
                color={'primary'}
                checked={endpoint.sorted}
                onChange={handleSortedChange}
                name="sorted"
              />
            }
            label="Sorted"
          />
        </Grid>
      )}
    </>
  );
};

export default OperationSection;
