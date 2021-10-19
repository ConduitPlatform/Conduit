import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@material-ui/core';
import React, { FC, useEffect, useState } from 'react';

import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import { makeStyles } from '@material-ui/core/styles';
import ConditionsEnum from '../../models/ConditionsEnum';

const useStyles = makeStyles((theme) => ({
  menuItem: {
    minHeight: 0,
    margin: theme.spacing(0),
    padding: theme.spacing(0),
    '&.MuiMenuItem-dense': {
      paddingLeft: 12,
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: 'white',
      '&:hover': {
        backgroundColor: theme.palette.primary.main,
        color: 'white',
      },
    },
  },
}));

interface Props {
  index: number;
  query: any;
  availableFieldsOfSchema: any;
  selectedInputs: {
    array: boolean;
    location: number;
    name: string;
    optional: boolean;
    type: string;
  }[];
  editMode: boolean;
  handleQueryFieldChange: any;
  handleQueryConditionChange: any;
  handleQueryComparisonFieldChange: any;
  handleCustomValueChange: any;
  handleLikeValueChange: any;
  handleRemoveQuery: any;
}

const CustomQueryRow: FC<Props> = ({
  index,
  query,
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
  const classes = useStyles();

  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    let type = 'string';
    if (typeof query.comparisonField.value === 'string') {
      type = 'string';
    } else if (typeof query.comparisonField.value === 'boolean') {
      type = 'boolean';
    } else if (typeof query.comparisonField.value === 'number') {
      type = 'number';
    } else if (Array.isArray(query.comparisonField.value)) {
      type = 'array';
    }

    if (query.comparisonField.type === 'Input') {
      const selectedInput = selectedInputs.find(
        (input) => input.name === query.comparisonField.value
      );
      if (selectedInput && selectedInput.array) {
        type = 'array';
      }
    }
    setSelectedType(type);
  }, [
    query.schemaField,
    query.type,
    query.comparisonField.value,
    query.comparisonField.type,
    selectedInputs,
  ]);

  const getSecondSubField = (field: any, valuePrefix: any, suffix: any) => {
    const keys = Object?.keys(field?.type);
    const itemTop = (
      <MenuItem
        className={classes.menuItem}
        dense
        style={{
          fontWeight: 'bold',
          paddingLeft: 8,
          background: 'rgba(0, 0, 0, 0.05)',
        }}
        value={`${valuePrefix}.${suffix}`}>
        {suffix}
      </MenuItem>
    );

    const restItems = keys?.map((item, i) => {
      if (typeof field.type === 'string' || Array.isArray(field.type)) {
        return (
          <MenuItem
            dense
            className={classes.menuItem}
            disabled={Array.isArray(field.type)}
            style={{
              background: 'rgba(0, 0, 0, 0.15)',
              paddingLeft: 24,
            }}
            key={`ido-${i}-field`}
            value={`${valuePrefix}.${suffix}.${item}`}>
            {item}
          </MenuItem>
        );
      }
    });

    return [itemTop, ...restItems];
  };

  const getSubFields = (field: any) => {
    if (field?.type) {
      const keys = Object?.keys(field?.type);

      const itemTop = (
        <MenuItem
          className={classes.menuItem}
          style={{
            fontWeight: 'bold',
          }}
          value={field.name}>
          {field.name}
        </MenuItem>
      );

      const restItems = keys?.map((item, i) => {
        if (
          typeof field.type?.[item]?.type === 'string' ||
          field.type?.[item]?.type instanceof String ||
          field.type?.[item]?.type === undefined ||
          Array.isArray(field.type?.[item]?.type)
        ) {
          return (
            <MenuItem
              dense
              className={classes.menuItem}
              disabled={Array.isArray(field.type)}
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
              }}
              key={`idSec-${i}-field`}
              value={`${field.name}.${item}`}>
              {item}
            </MenuItem>
          );
        } else {
          return getSecondSubField(field.type?.[item], field.name, item);
        }
      });

      return [itemTop, ...restItems];
    }
  };

  const prepareOptions = () => {
    return availableFieldsOfSchema.map((field: any, index: number) => {
      if (typeof field.type === 'string' || Array.isArray(field.type)) {
        return (
          <MenuItem className={classes.menuItem} key={`idxO-${index}-field`} value={field.name}>
            {field.name}
          </MenuItem>
        );
      }

      return getSubFields(field);
    });
  };

  const getCustomPlaceHolder = () => {
    if (selectedType === 'number') {
      return 'ex. 15';
    }
    return 'ex. John snow';
  };

  const inputCustomChange = (e: React.ChangeEvent<{ value: any }>, i: number) => {
    let value = e.target.value;
    if (selectedType === 'boolean') {
      value = value !== 'false';
    }
    if (selectedType === 'number') {
      value = parseInt(value);
    }

    handleCustomValueChange(value, i);
  };

  return (
    <>
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Field of schema</InputLabel>
          <Select
            fullWidth
            disabled={!editMode}
            value={query.schemaField}
            onChange={(event) => {
              handleQueryFieldChange(event, index);
            }}
            MenuProps={{
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'left',
              },
              transformOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              getContentAnchorEl: null,
            }}>
            <option aria-label="None" value="" />
            {prepareOptions()}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={3}>
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
            <option disabled={selectedType !== 'number'} value={ConditionsEnum.GREATER}>
              {'(>) greater than'}
            </option>
            <option disabled={selectedType !== 'number'} value={ConditionsEnum.GREATER_EQ}>
              {'(>=) greater that or equal to'}
            </option>
            <option disabled={selectedType !== 'number'} value={ConditionsEnum.LESS}>
              {'(<) less than'}
            </option>
            <option disabled={selectedType !== 'number'} value={ConditionsEnum.LESS_EQ}>
              {'(<=) less that or equal to'}
            </option>
            <option disabled={selectedType !== 'array'} value={ConditionsEnum.EQUAL_SET}>
              (in) equal to any of the following
            </option>
            <option disabled={selectedType !== 'array'} value={ConditionsEnum.NEQUAL_SET}>
              (not-in) not equal to any of the following
            </option>
            <option disabled={selectedType !== 'array'} value={ConditionsEnum.CONTAIN}>
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
              query.comparisonField.type === 'Custom' || query.comparisonField.type === 'Context'
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
              {availableFieldsOfSchema.map((field: any, index: number) => (
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
      {query.comparisonField.type === 'Custom' || query.comparisonField.type === 'Context' ? (
        <Grid item xs={2}>
          {selectedType === 'Boolean' ? (
            <Select
              disabled={!editMode}
              value={query.comparisonField.value}
              native
              fullWidth
              onChange={(event) => inputCustomChange(event, index)}>
              <option />
              <option value="true">true</option>
              <option value="false">false</option>
            </Select>
          ) : (
            <TextField
              type={selectedType?.toLowerCase()}
              label={
                query.comparisonField.type === 'Custom' ? 'Custom value' : 'Select from context'
              }
              variant={'filled'}
              disabled={!editMode}
              size={'small'}
              fullWidth
              placeholder={
                query.comparisonField.type === 'Custom' ? getCustomPlaceHolder() : 'ex. user._id'
              }
              value={query.comparisonField.value}
              onChange={(event) => inputCustomChange(event, index)}
            />
          )}
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
              disabled={!editMode}
            />
          }
          label="Like"
        />
      </Grid>
      <Grid item xs={1}>
        <IconButton disabled={!editMode} size="small" onClick={handleRemoveQuery}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Grid>
    </>
  );
};

export default CustomQueryRow;
