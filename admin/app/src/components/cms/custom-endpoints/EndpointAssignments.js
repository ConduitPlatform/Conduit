import {
  FormControl,
  Grid,
  Select,
  TextField,
  Typography,
  IconButton,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import React, { Fragment, useCallback } from 'react';
import ActionTypes from '../../../models/ActionTypes';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';

const useStyles = makeStyles((theme) => ({}));

const EndpointAssignments = ({
  selectedAssignments,
  editMode,
  availableFieldsOfSchema,
  selectedInputs,
  handleAssignmentFieldChange,
  handleAssignmentActionChange,
  handleAssignmentValueFieldChange,
  handleAssignmentCustomValueChange,
  handleRemoveAssignment,
}) => {
  const classes = useStyles();

  const isArrayType = useCallback(
    (fieldName) => {
      const field = availableFieldsOfSchema.find((f) => f.name === fieldName);
      if (field) {
        return field.type === 'Array';
      }
      return false;
    },
    [availableFieldsOfSchema]
  );

  const isNumberType = useCallback(
    (fieldName) => {
      const field = availableFieldsOfSchema.find((f) => f.name === fieldName);
      if (field) {
        return field.type === 'Number';
      }
      return false;
    },
    [availableFieldsOfSchema]
  );

  return selectedAssignments.map((assignment, index) => (
    <Fragment key={`assignment-${index}`}>
      <Grid item xs={1}>
        <Typography>{index + 1}.</Typography>
      </Grid>
      <Grid item xs={3}>
        <FormControl className={classes.formControl}>
          <Select
            fullWidth
            disabled={!editMode}
            native
            value={assignment.schemaField}
            onChange={(event) => handleAssignmentFieldChange(event, index)}>
            <option aria-label="None" value="" />
            {availableFieldsOfSchema.map((field, index) => (
              <option key={`idx-${index}-field`} value={field.name}>
                {field.name}
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
            value={assignment.action}
            onChange={(event) => handleAssignmentActionChange(event, index)}>
            <option aria-label="None" value="" />
            <option value={ActionTypes.SET}>SET</option>
            <option
              disabled={!isNumberType(assignment.schemaField)}
              value={ActionTypes.INCREMENT}>
              INCREMENT
            </option>
            <option
              disabled={!isNumberType(assignment.schemaField)}
              value={ActionTypes.DECREMENT}>
              DECREMENT
            </option>
            <option
              disabled={!isArrayType(assignment.schemaField)}
              value={ActionTypes.APPEND}>
              APPEND
            </option>
            <option
              disabled={!isArrayType(assignment.schemaField)}
              value={ActionTypes.REMOVE}>
              REMOVE
            </option>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={2}>
        <FormControl className={classes.formControl}>
          <Select
            fullWidth
            disabled={!editMode}
            native
            value={
              assignment.assignmentField.type === 'Custom'
                ? assignment.assignmentField.type
                : assignment.assignmentField.type + '-' + assignment.assignmentField.value
            }
            onChange={(event) => handleAssignmentValueFieldChange(event, index)}>
            <option aria-label="None" value="" />
            <optgroup label="Custom Value">
              <option value={'Custom'}>Add a custom value</option>
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
      {assignment.assignmentField.type === 'Custom' ? (
        <Grid item xs={2}>
          <TextField
            label={'Custom Value'}
            variant={'outlined'}
            disabled={!editMode}
            fullWidth
            placeholder={'Value'}
            value={assignment.assignmentField.value}
            onChange={(event) => handleAssignmentCustomValueChange(event, index)}
          />
        </Grid>
      ) : (
        <Grid item xs={2}></Grid>
      )}
      <Grid item xs={1}>
        <IconButton
          disabled={!editMode}
          size="small"
          onClick={() => handleRemoveAssignment(index)}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Grid>
    </Fragment>
  ));
};

export default EndpointAssignments;
