export const cloneItem = (destination, item, droppableDestination) => {
  const clone = Array.from(destination);

  clone.splice(droppableDestination.index, 0, {...item});
  return clone;
};

export const addToGroup = (data, groupId, item, droppableDestination) => {
  let idPosition = data.findIndex(i => i.id === groupId);
  const clone = Array.from(data);

  clone[idPosition].content.splice(droppableDestination.index, 0, {...item});

  return clone;
};

export const addToChildGroup = (data, groupId, item, droppableDestination) => {
  const clone = Array.from(data);
  const idPosition = data.findIndex(object => {
    return object.content.find(content => content.id === groupId)
  });

  const idPosition2 = data[idPosition].content.findIndex(object2 => object2.id === groupId);

  clone[idPosition].content[idPosition2].content.splice(droppableDestination.index, 0, {...item});
  return clone
};

export const updateItem = (items, item, index) => {
  const updated = Array.from(items);

  updated.splice(index, 1, {...item});
  return updated;
};

export const updateGroupItem = (data, groupId, item, position) => {
  let idPosition = data.findIndex(i => i.id === groupId);
  const clone = Array.from(data);

  clone[idPosition].content.splice(position, 1, {...item});

  return clone;
};

export const updateGroupChildItem = (data, groupId, item, position) => {
  const clone = Array.from(data);
  const idPosition = data.findIndex(object => {
    return object.content.find(content => content.id === groupId)
  });

  const idPosition2 = data[idPosition].content.findIndex(object2 => object2.id === groupId);

  clone[idPosition].content[idPosition2].content.splice(position, 1, {...item});
  return clone
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
