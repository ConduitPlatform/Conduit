import { Payload } from '../AuthenticationProviders/interfaces/Payload';

export interface MicrosoftUser extends Payload {
  data: {
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
}