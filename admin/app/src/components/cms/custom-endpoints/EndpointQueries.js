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
import { deepClone } from '../../utils/deepClone';

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

  const findModifiedQuery = (allQueries, queryId) => {
    allQueries = deconstructQueries(allQueries);
    return allQueries.find((q) => q._id === queryId);
  };

  const handleQueryFieldChange = (event, queryId) => {
    const currentQueries = deepClone(selectedQueries);
    const foundQuery = findModifiedQuery(currentQueries, queryId);
    const value = event.target.value;
    if (foundQuery) {
      foundQuery.schemaField = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryComparisonFieldChange = (event, queryId) => {
    const currentQueries = deepClone(selectedQueries);
    const foundQuery = findModifiedQuery(currentQueries, queryId);

    const value = event.target.value;
    const type = value.split('-')[0];
    const actualValue = value.split('-')[1];
    if (foundQuery) {
      foundQuery.comparisonField.type = type;
      foundQuery.comparisonField.value = actualValue ? actualValue : '';
      setSelectedQueries(currentQueries);
    }
  };

  const handleCustomValueChange = (event, queryId) => {
    const value = event;
    const currentQueries = deepClone(selectedQueries);
    const foundQuery = findModifiedQuery(currentQueries, queryId);
    if (foundQuery) {
      foundQuery.comparisonField.value = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleQueryConditionChange = (event, queryId) => {
    const value = event.target.value;
    const currentQueries = deepClone(selectedQueries);
    const foundQuery = findModifiedQuery(currentQueries, queryId);
    if (foundQuery) {
      foundQuery.operation = Number(value);
      setSelectedQueries(currentQueries);
    }
  };

  const handleLikeValueChange = (event, queryId) => {
    const currentQueries = deepClone(selectedQueries);
    const foundQuery = findModifiedQuery(currentQueries, queryId);

    const value = event.target.checked;
    if (foundQuery) {
      foundQuery.comparisonField.like = value;
      setSelectedQueries(currentQueries);
    }
  };

  const handleRemoveQuery = (queryId) => {
    const currentQueries = deepClone(selectedQueries);
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
        <Box key={node._id}>
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
        </Box>
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
