export interface MicrosoftUser {
  id: string;
  mail: string;
  displayName?: string;
  givenName?: string;
  jobTitle?: string;
  surname?: string;
  userPrincipalName?: string;
  mobilePhone?: string;
  officeLocation?: string;
  preferredLanguage?: string;
  businessPhones?: string[];
}
