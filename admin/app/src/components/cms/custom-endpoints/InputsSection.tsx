import { Button, Divider, Grid, Typography } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import EndpointInputs from './EndpointInputs';
import React from 'react';
import { setEndpointData } from '../../../redux/slices/customEndpointsSlice';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';

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

const InputsSection = ({ editMode }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { endpoint, schemaFields } = useAppSelector(
    (state) => state.customEndpointsSlice.data
  );

  const handleAddInput = () => {
    const input = {
      name: '',
      type: '',
      location: -1,
      array: false,
      optional: false,
    };
    dispatch(setEndpointData({ inputs: [...endpoint.inputs, input] }));
  };

  const maxInputs = () => {
    return endpoint.inputs.length === schemaFields.length;
  };

  const deconstructQueries = (queries) => {
    let allQueries = [];
    queries.forEach((query) => {
      if ('operator' in query) {
        allQueries = allQueries.concat(deconstructQueries(query.queries));
      } else {
        allQueries.push(query);
      }
    });

    return allQueries;
  };

  const handleRemoveInput = (index: number) => {
    const input = endpoint.inputs[index];
    const currentInputs = endpoint.inputs.slice();
    currentInputs.splice(index, 1);

    const updatedQueries = endpoint.queries.slice();
    const queries = deconstructQueries(updatedQueries);

    queries.map((q) => {
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

    const updatedAssignments = endpoint.assignments.slice().map((a) => {
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

    dispatch(
      setEndpointData({
        inputs: currentInputs,
        queries: updatedQueries,
        assignments: updatedAssignments,
      })
    );
  };

  const handleInputsChanges = (inputs) => {
    dispatch(setEndpointData({ inputs }));
  };

  return (
    <>
      <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
        <Typography>
          <strong>Inputs</strong>
        </Typography>
      </Grid>
      <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
        <Button
          disabled={!editMode || maxInputs()}
          variant="text"
          color={'primary'}
          className={classes.button}
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddInput}>
          Add another
        </Button>
      </Grid>
      <Grid item xs={12} style={{ padding: '0' }}>
        <Divider />
      </Grid>
      <EndpointInputs
        editMode={editMode}
        selectedInputs={endpoint.inputs}
        setSelectedInputs={handleInputsChanges}
        handleRemoveInput={handleRemoveInput}
      />
      <Grid item xs={12} style={{ padding: '0' }}>
        <Divider />
      </Grid>
    </>
  );
};
export default InputsSection;
