import { Button, Divider, Grid, Typography } from '@material-ui/core';
import OperationsEnum from '../../../models/OperationsEnum';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import EndpointAssignments from './EndpointAssignments';
import React from 'react';
import { setEndpointData } from '../../../redux/actions/customEndpointsActions';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  button: {
    margin: theme.spacing(1),
    textTransform: 'none',
  },
}));

const AssignmentsSection = ({ editMode }) => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const { endpoint, schemaFields } = useSelector((state) => state.customEndpointsReducer);

  const handleAddAssignment = () => {
    const assignment = {
      schemaField: '',
      action: 0,
      assignmentField: { type: '', value: '' },
    };
    dispatch(setEndpointData({ assignments: [...endpoint.assignments, assignment] }));
  };

  const handleAssignmentChanges = (assignments) => {
    dispatch(setEndpointData({ assignments }));
  };

  return (
    <>
      <Grid item xs={6} style={{ padding: '0 0 0 10px' }}>
        <Typography>
          <strong>Assignments</strong>
        </Typography>
      </Grid>
      <Grid item xs={6} style={{ textAlign: 'end', padding: '0' }}>
        <Button
          disabled={!editMode || endpoint.operation === OperationsEnum.POST}
          variant="text"
          color={'primary'}
          className={classes.button}
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddAssignment}>
          Add another
        </Button>
      </Grid>
      <Grid item xs={12} style={{ padding: '0' }}>
        <Divider />
      </Grid>
      <EndpointAssignments
        editMode={editMode}
        selectedInputs={endpoint.inputs}
        operationType={endpoint.operation}
        selectedAssignments={endpoint.assignments}
        setSelectedAssignments={handleAssignmentChanges}
        availableFieldsOfSchema={schemaFields}
      />
    </>
  );
};

export default AssignmentsSection;
