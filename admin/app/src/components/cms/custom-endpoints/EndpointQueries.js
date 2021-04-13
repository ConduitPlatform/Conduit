import React, { Fragment } from 'react';
import CustomQueryRow from '../CustomQueryRow';

const EndpointQueries = ({
  selectedSchema,
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
  return selectedQueries.map((query, index) => {
    return (
      <Fragment key={`query-${selectedSchema}-${index}`}>
        <CustomQueryRow
          query={query}
          index={index}
          availableFieldsOfSchema={availableFieldsOfSchema}
          selectedInputs={selectedInputs}
          editMode={editMode}
          handleQueryFieldChange={handleQueryFieldChange}
          handleQueryComparisonFieldChange={handleQueryComparisonFieldChange}
          handleCustomValueChange={handleCustomValueChange}
          handleQueryConditionChange={handleQueryConditionChange}
          handleLikeValueChange={handleLikeValueChange}
          handleRemoveQuery={handleRemoveQuery}
        />
      </Fragment>
    );
  });
};

export default EndpointQueries;
