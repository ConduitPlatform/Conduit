import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  Select,
  TextField,
  MenuItem,
  Typography,
} from '@material-ui/core';
import React, { Fragment, useState } from 'react';
import ConditionsEnum from '../../../models/ConditionsEnum';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  menuItem: {
    margin: theme.spacing(0),
    padding: theme.spacing(0),
    '&.MuiMenuItem-dense': {
      paddingLeft: 12,
    },
  },
}));

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
  let classes = useStyles();
  console.log(availableFieldsOfSchema);
  const [selectedType, setSelectedType] = useState('');

  const prepareOptions = () => {
    return availableFieldsOfSchema.map((field, index) => {
      if (
        typeof field.type === 'string' ||
        field.type instanceof String ||
        field.type === undefined
      ) {
        return (
          <MenuItem
            className={classes.menuItem}
            key={`idxO-${index}-field`}
            onClick={() => setSelectedType(field.type)}
            value={field.name}>
            {field.name}
          </MenuItem>
        );
      }

      if (field?.type) {
        let keys = Object?.keys(field?.type);
        let itemTop = (
          <MenuItem
            className={classes.menuItem}
            style={{ fontWeight: 'bold', background: 'rgba(0, 0, 0, 0.10)' }}
            value={field.name}
            onClick={() => setSelectedType('')}>
            {field.name}
          </MenuItem>
        );
        let restItems = keys?.map((item, i) => {
          console.log(item);
          return (
            <MenuItem
              dense
              className={classes.menuItem}
              onClick={() => setSelectedType(field.type?.[item]?.type)}
              disabled={Array.isArray(field.type)}
              style={{ background: 'rgba(0, 0, 0, 0.05)' }}
              key={`ido-${index}-${i}-field`}
              value={`${field.name}.${item}`}>
              {/*{field.name}.*/}
              {item}
            </MenuItem>
          );
        });
        return [itemTop, ...restItems];
      }
    });
  };

  console.log(selectedType);

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
            value={query.schemaField}
            onChange={(event) => {
              // prepareType(event);
              handleQueryFieldChange(event, index);
            }}>
            <option aria-label="None" value="" />
            {prepareOptions()}
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
            <option disabled={selectedType === 'String'} value={ConditionsEnum.GREATER}>
              {'(>) greater than'}
            </option>
            <option
              disabled={selectedType === 'String'}
              value={ConditionsEnum.GREATER_EQ}>
              {'(>=) greater that or equal to'}
            </option>
            <option disabled={selectedType === 'String'} value={ConditionsEnum.LESS}>
              {'(<) less than'}
            </option>
            <option disabled={selectedType === 'String'} value={ConditionsEnum.LESS_EQ}>
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
                <option key={`idxS-${index}-field`} value={'Schema-' + field.name}>
                  {field.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Input Fields">
              {selectedInputs.map((input, index) => (
                <option key={`idxF-${index}-input`} value={'Input-' + input.name}>
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
