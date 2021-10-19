import { FormsModel } from '../models/forms/FormsModels';

export const handleDeleteTitle = (multiple: boolean, form: FormsModel) => {
  if (multiple) {
    return 'Delete selected forms';
  }
  return `Delete form ${form.name}`;
};

export const handleDeleteDescription = (multiple: boolean, form: FormsModel) => {
  if (multiple) {
    return 'Are you sure you want to delete the selected forms?';
  }
  return `Are you sure you want to delete ${form.name}? `;
};
