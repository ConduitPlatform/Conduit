const findFieldsWithTypes = (fields) => {
  const fieldKeys = Object.keys(fields);
  const fieldsWithTypes = [];
  fieldKeys.forEach((field) => {
    fieldsWithTypes.push({ name: field, type: fields[field].type });
  });
  return fieldsWithTypes;
};

const getAvailableFieldsOfSchema = (schemaSelected, schemas) => {
  if (schemaSelected) {
    const found = schemas.find((schema) => schema._id === schemaSelected);
    if (found) {
      return found.fields;
    }
    return {};
  }
};

const hasInvalidQueries = (queriesGroup) => {
  let queries = [];
  queriesGroup.forEach((q1) => {
    if (!q1.queries) return;
    queries.concat(q1.queries);
    q1.queries.forEach((q2) => {
      if (!q2.queries) return;
      queries.concat(q2.queries);
      q2.queries.forEach((q3) => {
        if (!q3.queries) return;
        queries.concat(q3.queries);
      });
    });
  });

  return queries.some(
    (query) =>
      query.schemaField === '' ||
      query.operation === -1 ||
      query.comparisonField.type === '' ||
      query.comparisonField.value === ''
  );
};

const hasInvalidAssignments = (assignments) => {
  return assignments.some(
    (assignment) =>
      assignment.schemaField === '' ||
      assignment.action === -1 ||
      assignment.assignmentField.type === '' ||
      assignment.assignmentField.value === ''
  );
};

const hasInvalidInputs = (inputs) =>
  inputs.some((input) => input.name === '' || input.type === '' || input.location === -1);

const recursiveNodeIteration = (node, _id) => {
  if (node._id === _id) return node;
  if ('queries' in node) {
    let found;
    node.queries.forEach((q) => {
      if (q._id === _id) {
        found = q;
        return;
      }
      if ('queries' in q) {
        recursiveNodeIteration(q, _id);
      }
    });

    return found;
  }
};

const prepareQuery = (selectedQueries) => {
  let query = {};

  selectedQueries.forEach((node) => {
    const queries = [];

    if ('operator' in node) {
      node.queries.forEach((q1) => {
        const level1NodeQueries = [];
        if ('operator' in q1) {
          const level2NodeQueries = [];
          q1.queries.forEach((q2) => {
            if ('operator' in q2) {
              q2.queries.forEach((q3) => {
                level2NodeQueries.push(q3);
              });
              level1NodeQueries.push({ [q2.operator]: level2NodeQueries });
            } else {
              level1NodeQueries.push(q2);
            }
          });
          queries.push({ [q1.operator]: level1NodeQueries });
        } else {
          queries.push(q1);
        }
      });
      query = { ...query, [node.operator]: [...queries] };
    }
  });

  return query;
};

export {
  findFieldsWithTypes,
  getAvailableFieldsOfSchema,
  hasInvalidQueries,
  hasInvalidAssignments,
  hasInvalidInputs,
  recursiveNodeIteration,
  prepareQuery,
};
