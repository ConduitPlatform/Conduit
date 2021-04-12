export const cloneItem = (destination, item, droppableDestination) => {
  const clone = Array.from(destination);

  clone.splice(droppableDestination.index, 0, { ...item });
  return clone;
};

export const addToGroup = (data, groupId, item, droppableDestination) => {
  let idPosition = data.findIndex((i) => i.name === groupId);
  const clone = Array.from(data);

  clone[idPosition].content.splice(droppableDestination.index, 0, { ...item });

  return clone;
};

export const addToChildGroup = (data, groupId, item, droppableDestination) => {
  const clone = Array.from(data);
  const idPosition = data.findIndex((object) => {
    if (object.content) {
      return object.content.find((content) => content.name === groupId);
    }
  });

  const idPosition2 = data[idPosition].content.findIndex(
    (object2) => object2.name === groupId
  );

  clone[idPosition].content[idPosition2].content.splice(droppableDestination.index, 0, {
    ...item,
  });
  return clone;
};

export const updateItem = (items, item, index) => {
  const updated = Array.from(items);

  updated.splice(index, 1, { ...item });
  return updated;
};

export const updateGroupItem = (data, groupId, item, position) => {
  let idPosition = data.findIndex((i) => i.name === groupId);
  const clone = Array.from(data);

  clone[idPosition].content.splice(position, 1, { ...item });

  return clone;
};

export const updateGroupChildItem = (data, groupId, item, position) => {
  const clone = Array.from(data);
  const idPosition = data.findIndex((object) => {
    return object.content.find((content) => content.name === groupId);
  });

  const idPosition2 = data[idPosition].content.findIndex(
    (object2) => object2.name === groupId
  );

  clone[idPosition].content[idPosition2].content.splice(position, 1, { ...item });
  return clone;
};

export const deleteItem = (items, index) => {
  const deleted = Array.from(items);

  deleted.splice(index, 1);
  return deleted;
};

export const reorderItems = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export const getSchemaFields = (schemaFields) => {
  let keys;
  if (!schemaFields) return;
  if (Array.isArray(schemaFields)) {
    keys = Object.keys(schemaFields[0]);
  } else {
    keys = Object.keys(schemaFields);
  }
  const fields = [];
  keys.forEach((k) => {
    if (typeof schemaFields[k] !== 'string' && typeof schemaFields[k] !== 'boolean') {
      const field = schemaFields[k];
      fields.push({ name: k, ...constructFieldType(field) });
    }
  });
  return fields;
};

export const getSchemaFieldsWithExtra = (schemaFields) => {
  let keys;
  if (!schemaFields) return;
  if (Array.isArray(schemaFields)) {
    keys = Object.keys(schemaFields[0]);
  } else {
    keys = Object.keys(schemaFields);
  }
  const fields = [];
  keys.forEach((k) => {
    if (typeof schemaFields[k] !== 'string' && typeof schemaFields[k] !== 'boolean') {
      const field = schemaFields[k];
      fields.push({ name: k, ...constructFieldType(field) });
    } else {
      const field = schemaFields[k];
      if (k === 'createdAt' || k === 'updatedAt') {
        fields.push({
          name: k,
          type: 'Date',
          unique: false,
          select: true,
          required: false,
          value: field,
        });
      }
      if (k === '_id') {
        fields.push({
          name: k,
          type: 'ObjectId',
          unique: true,
          select: true,
          required: false,
          value: field,
        });
      }
    }
  });
  return fields;
};

const checkIsChildOfObject = (innerFields) => {
  const type = typeof innerFields;
  return type !== 'string';
};

const constructFieldType = (field) => {
  const typeField = {};
  if (checkIsChildOfObject(field.type)) {
    typeField.isArray = Array.isArray(field.type);
    if (typeField.isArray) {
      let obj = {};
      field.type.forEach((f) => {
        obj = { ...obj, ...f };
      });
      if (obj && obj.type === 'Relation') {
        typeField.relation = true;
        typeField.type = 'Relation';
        typeField.select = obj.select;
        typeField.required = obj.required;
        typeField.model = obj.model;
      } else {
        typeField.content = getSchemaFields(obj);
      }
    } else {
      typeField.content = getSchemaFields(field.type);
    }
  }
  typeField.isArray = Array.isArray(field.type);
  if (typeField.isArray && !typeField.type) {
    typeField.type = field.type[0];
  } else {
    if (!typeField.type) typeField.type = field.type;
  }
  typeField.type = typeTransformer(typeField.type);
  if (typeField.type === '') {
    typeField.type = 'Group';
  }

  if (typeField.type !== 'Group') {
    typeField.unique = field.unique ? field.unique : false;
  }
  if (field.type === 'Relation' && typeField.isArray) {
    typeField.relation = field.relation;
    typeField.type = field.type[0].type;
    typeField.select = field.type[0].select;
    typeField.required = field.type[0].required;
    typeField.model = field.type[0].model;
  } else {
    typeField.select = field.select ? field.select : false;
    typeField.required = field.required ? field.required : false;
  }

  if (field.default !== undefined && field.default !== null) {
    typeField.default = field.default;
  }

  if (field.enum !== undefined && field.enum !== null) {
    typeField.enumValues = field.enum;
    typeField.isEnum = true;
  }
  return typeField;
};

const typeTransformer = (type) => {
  if (!type) {
    return '';
  }
  switch (type) {
    case 'String':
      return 'Text';
    case 'Number':
      return 'Number';
    case 'Date':
      return 'Date';
    case 'ObjectId':
      return 'ObjectId';
    case 'Boolean':
      return 'Boolean';
    case 'Relation':
      return 'Relation';
    case 'Enum':
      return 'Enum';
    default:
      return '';
  }
};

const prepareTypes = (type, isArray, content, enumType, select, required, model) => {
  switch (type) {
    case 'Text':
      return isArray ? ['String'] : 'String';
    case 'Number':
      return isArray ? ['Number'] : 'Number';
    case 'Date':
      return isArray ? ['Date'] : 'Date';
    case 'Boolean':
      return isArray ? ['Boolean'] : 'Boolean';
    case 'ObjectId':
      return 'ObjectId';
    case 'Relation':
      return isArray
        ? [
            {
              select,
              required,
              type: 'Relation',
              model: model ? model.toString() : '',
            },
          ]
        : 'Relation';
    case 'JSON':
      return 'JSON';
    case 'Enum':
      return enumType === 'Text' ? 'String' : 'Number';
    case 'Group':
      return prepareFields(content);
    default:
      break;
  }
};

const prepareDefaultValue = (type, isArray, content) => {
  switch (type) {
    case 'Text':
      return isArray ? [content] : content;
    case 'Number':
      return isArray ? [parseInt(content)] : parseInt(content);
    case 'Date':
      return isArray ? [content] : content;
    case 'Boolean':
      return isArray ? [content] : content;
    default:
      return content;
  }
};

export const prepareFields = (typeFields) => {
  let deconstructed = {};
  if (!typeFields) {
    return deconstructed;
  }
  typeFields.forEach((u) => {
    const clone = Object.assign({}, { ...u });
    const name = clone.name;
    let fields;
    if (clone.type === 'Group') {
      if (clone.isArray) {
        fields = {
          select: clone.select ? clone.select : false,
          required: clone.required ? clone.required : false,
          type: [
            prepareTypes(
              clone.isEnum ? 'Enum' : clone.type,
              clone.isArray,
              clone.content,
              clone.isEnum ? clone.type : null,
              clone.select,
              clone.required,
              clone.model
            ),
          ],
        };
      } else {
        fields = {
          select: clone.select ? clone.select : false,
          required: clone.required ? clone.required : false,
          type: prepareTypes(
            clone.isEnum ? 'Enum' : clone.type,
            clone.isArray,
            clone.content,
            clone.isEnum ? clone.type : null,
            clone.select,
            clone.required,
            clone.model
          ),
        };
      }
    } else {
      if (clone.type === 'Relation' && clone.isArray) {
        fields = {
          type: prepareTypes(
            clone.isEnum ? 'Enum' : clone.type,
            clone.isArray,
            clone.content,
            clone.isEnum ? clone.type : null,
            clone.select,
            clone.required,
            clone.model
          ),
        };
      } else {
        fields = {
          type: clone.type
            ? prepareTypes(
                clone.isEnum ? 'Enum' : clone.type,
                clone.isArray,
                clone.content,
                clone.isEnum ? clone.type : null
              )
            : '',
          unique: clone.unique ? clone.unique : false,
          select: clone.select ? clone.select : false,
          required: clone.required ? clone.required : false,
        };
      }
    }
    if (clone.default !== null && clone.default !== undefined && clone.default !== '') {
      //fields.default=clone.default
      fields.default = prepareDefaultValue(
        clone.isEnum ? 'Enum' : clone.type,
        clone.isArray,
        clone.default
      );
    }

    if (clone.isEnum) {
      fields.enum = clone?.enumValues; //.split(/[\n,]+/);
    }

    if (clone.type === 'Relation' && !clone.isArray) {
      if (clone.model) fields.model = clone.model.toString();
    }

    delete clone.name;
    if (clone.type === 'Group') {
      deconstructed = { ...deconstructed, [name]: { ...fields } };
    } else {
      deconstructed = { ...deconstructed, [name]: { ...fields } };
    }
  });
  return deconstructed;
};
