import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import React, { Fragment } from 'react';
import ConditionsEnum from '../../../models/ConditionsEnum';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';

const EndpointQueries = ({
  selectedQueries,
  availableFieldsOfSchema,
  selectedInputs,
  editMode,
  handleQueryFieldChange,
  handleQueryConditionChange,
  handleQueryComparisonFieldChange,
  handleCustomValueChange,
  handleLikeValueChange,
  handleRemoveQuery,
}) => {
  return selectedQueries.map((query, index) => (
    <Fragment key={`query-${index}`}>
      <Grid item xs={1}>
        <Typography>{index + 1}.</Typography>
      </Grid>
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Field of schema</InputLabel>
          <Select
            fullWidth
            disabled={!editMode}
            native
            value={query.schemaField}
            onChange={(event) => handleQueryFieldChange(event, index)}>
            <option aria-label="None" value="" />
            {availableFieldsOfSchema.map((field, index) => (
              <option key={`idx-${index}-field`} value={field.name}>
                {field.name}
              </option>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Operator</InputLabel>
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
            <option value={ConditionsEnum.LESS_EQ}>{'(<=) less that or equal to'}</option>
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
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Value</InputLabel>
          <Select
            fullWidth
            disabled={!editMode}
            native
            value={
              query.comparisonField.type === 'Custom' ||
              query.comparisonField.type === 'Context'
                ? query.comparisonField.type
                : query.comparisonField.type + '-' + query.comparisonField.value
            }
            onChange={(event) => handleQueryComparisonFieldChange(event, index)}>
            <option aria-label="None" value="" />
            <optgroup label="System Values">
              <option value={'Context'}>Add value from context</option>
            </optgroup>
            <optgroup label="Custom Value">
              <option value={'Custom'}>Add a custom value</option>
            </optgroup>
            <optgroup label="Schema Fields">
              {availableFieldsOfSchema.map((field, index) => (
                <option key={`idx-${index}-field`} value={'Schema-' + field.name}>
                  {field.name}
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
      {query.comparisonField.type === 'Custom' ||
      query.comparisonField.type === 'Context' ? (
        <Grid item xs={2}>
          <TextField
            label={
              query.comparisonField.type === 'Custom'
                ? 'Custom value'
                : 'Select from context'
            }
            variant={'filled'}
            disabled={!editMode}
            size={'small'}
            fullWidth
            placeholder={
              query.comparisonField.type === 'Custom' ? 'ex. John Snow' : 'ex. user._id'
            }
            value={query.comparisonField.value}
            onChange={(event) => handleCustomValueChange(event, index)}
          />
        </Grid>
      ) : (
        <Grid item xs={2} />
      )}
      <Grid item xs={2}>
        <FormControlLabel
          control={
            <Checkbox
              color={'primary'}
              checked={query.comparisonField.like}
              onChange={(event) => handleLikeValueChange(event, index)}
              name="Like"
              size={'small'}
            />
          }
          label="Like"
        />
      </Grid>
      <Grid item xs={1}>
        <IconButton
          disabled={!editMode}
          size="small"
          onClick={() => handleRemoveQuery(index)}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Grid>
    </Fragment>
  ));
};

export default EndpointQueries;
