import { EmailTemplateType } from '../models/emails/EmailModels';

export const handleDeleteTitle = (multiple: boolean, template: EmailTemplateType) => {
  if (multiple) {
    return 'Delete selected templates';
  }
  return `Delete template ${template.name}`;
};

export const handleDeleteDescription = (multiple: boolean, template: EmailTemplateType) => {
  if (multiple) {
    return 'Are you sure you want to delete the selected templates?';
  }
  return `Are you sure you want to delete ${template.name}? `;
};
