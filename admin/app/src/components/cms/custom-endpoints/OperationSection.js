import React from 'react';
import {
  Grid,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import OperationsEnum from '../../../models/OperationsEnum';

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

const OperationSection = ({
  availableSchemas,
  selectedSchema,
  selectedOperation,
  editMode,
  handleOperationChange,
  handleSchemaChange,
  authentication,
  handleAuthenticationChange,
  paginated,
  handlePaginatedChange,
  sorted,
  handleSortedChange,
}) => {
  const classes = useStyles();
  return (
    <>
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
              <option key={`schema-${index}`} value={schema._id}>
                {schema.name}
              </option>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={selectedOperation === OperationsEnum.GET ? 2 : 4}>
        <FormControlLabel
          control={
            <Checkbox
              disabled={!editMode}
              color={'primary'}
              checked={authentication}
              onChange={handleAuthenticationChange}
              name="authentication"
            />
          }
          label="Authenticated"
        />
      </Grid>
      {selectedOperation === OperationsEnum.GET && (
        <Grid item xs={2}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={!editMode}
                color={'primary'}
                checked={paginated}
                onChange={handlePaginatedChange}
                name="paginated"
              />
            }
            label="Paginated"
          />
        </Grid>
      )}
      {selectedOperation === OperationsEnum.GET && (
        <Grid item xs={2}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={!editMode}
                color={'primary'}
                checked={sorted}
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
