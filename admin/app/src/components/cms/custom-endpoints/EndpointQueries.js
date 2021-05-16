import React from 'react';
import CustomQueryRow from '../CustomQueryRow';
import StyledTreeItem from '../../custom/StyledTreeItem';
import TreeItemContent from './TreeItemContent';
import { Grid } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import { TreeView } from '@material-ui/lab';
import MinusSquare from '../../svgs/MinusSquare';
import PlusSquare from '../../svgs/PlusSquare';
import CloseSquare from '../../svgs/CloseSquare';

const useStyles = makeStyles({
  root: {
    flexGrow: 1,
  },
});

const EndpointQueries = ({
  editMode,
  selectedSchema,
  selectedQueries,
  selectedInputs,
  handleAddQuery,
  handleAddNode,
  handleRemoveNode,
  setSelectedQueries,
  availableFieldsOfSchema,
  handleChangeNodeOperator,
}) => {
  const classes = useStyles();

  const handleQueryFieldChange = (event, index) => {
    const value = event.target.value;
    const currentQueries = selectedQueries.slice();
    const input = currentQueries[index];
    if (input) {
      input.schemaField = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryComparisonFieldChange = (event, index) => {
    const value = event.target.value;

    const type = value.split('-')[0];
    const actualValue = value.split('-')[1];

    const currentQueries = selectedQueries.slice();
    const query = currentQueries[index];
    if (query) {
      query.comparisonField.type = type;
      query.comparisonField.value = actualValue ? actualValue : '';
      setSelectedQueries(currentQueries);
    }
  };

  const handleCustomValueChange = (event, index) => {
    const value = event;
    const currentQueries = selectedQueries.slice();
    const query = currentQueries[index];
    if (query) {
      query.comparisonField.value = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryConditionChange = (event, index) => {
    const value = event.target.value;
    const currentQueries = selectedQueries.slice();
    const input = currentQueries[index];
    if (input) {
      input.operation = Number(value);
      setSelectedQueries(currentQueries);
    }
  };

  const handleLikeValueChange = (event, index) => {
    const value = event.target.checked;
    const currentQueries = selectedQueries.slice();
    const query = currentQueries[index];
    if (query) {
      query.comparisonField.like = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleRemoveQuery = (queryId) => {
    const currentQueries = selectedQueries.slice();
    let foundIndex = -1;

    currentQueries.forEach((topNode) => {
      topNode.queries.forEach((q1, index1) => {
        if (q1._id === queryId) {
          foundIndex = index1;
        }
        if (foundIndex !== -1) {
          topNode.queries.splice(foundIndex, 1);
        } else {
          if ('queries' in q1) {
            q1.queries.forEach((q2, index2) => {
              if (q2._id === queryId) {
                foundIndex = index2;
              }
              if (foundIndex !== -1) {
                q1.queries.splice(foundIndex, 1);
              } else {
                q2.queries.forEach((q3, index3) => {
                  if (q3._id === queryId) {
                    foundIndex = index3;
                  }
                  if (foundIndex !== -1) {
                    q2.queries.splice(foundIndex, 1);
                  }
                });
              }
            });
          }
        }
      });
    });

    setSelectedQueries(currentQueries);
  };

  const handleOperatorChange = (index, oldOperator, newOperator) => {
    handleChangeNodeOperator(index, oldOperator, newOperator);
  };

  const renderItem = (node) => {
    if ('operator' in node && node.queries) {
      return (
        <>
          <StyledTreeItem
            key={node._id}
            nodeId={node._id}
            onLabelClick={(e) => e.preventDefault()}
            label={
              <TreeItemContent
                editMode={editMode}
                operator={node.operator}
                handleAddQuery={() => handleAddQuery(node._id)}
                handleAddNode={() => handleAddNode(node._id)}
                handleRemoveNode={() => handleRemoveNode(node._id)}
                handleOperatorChange={(operator) =>
                  handleOperatorChange(node._id, node.operator, operator)
                }
              />
            }>
            {node.queries.map((q) => renderItem(q))}
          </StyledTreeItem>
        </>
      );
    }
    if ('schemaField' in node) {
      return (
        <StyledTreeItem
          key={node._id}
          nodeId={node._id}
          onLabelClick={(e) => e.preventDefault()}
          label={
            <Grid
              container
              alignItems={'flex-end'}
              spacing={2}
              key={`query-${selectedSchema}-${node._id}`}>
              <CustomQueryRow
                query={node}
                index={node._id}
                availableFieldsOfSchema={availableFieldsOfSchema}
                selectedInputs={selectedInputs}
                editMode={editMode}
                handleQueryFieldChange={handleQueryFieldChange}
                handleQueryComparisonFieldChange={handleQueryComparisonFieldChange}
                handleCustomValueChange={handleCustomValueChange}
                handleQueryConditionChange={handleQueryConditionChange}
                handleLikeValueChange={handleLikeValueChange}
                handleRemoveQuery={() => handleRemoveQuery(node._id)}
              />
            </Grid>
          }
        />
      );
    }
  };

  return (
    <Box padding={5} width={'100%'}>
      <TreeView
        className={classes.root}
        defaultCollapseIcon={<MinusSquare />}
        defaultExpandIcon={<PlusSquare />}
        defaultEndIcon={<CloseSquare />}
        onNodeSelect={(e) => e.preventDefault()}
        onNodeToggle={(e) => e.preventDefault()}>
        {selectedQueries.map((q) => renderItem(q))}
      </TreeView>
    </Box>
  );
};

export default EndpointQueries;
