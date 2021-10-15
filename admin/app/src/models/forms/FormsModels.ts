export interface FormsModel {
  _id: string;
  name: string;
  fields: object;
  forwardTo: string;
  emailField: string;
  enabled: boolean;
}

export interface FormReplies {
  _id: string;
  form: FormsModel;
  data: object;
  possibleSpam: boolean;
}

export interface FormSettingsConfig {
  active: boolean;
  useAttachments: boolean;
}
