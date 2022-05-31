import { Payload } from '../interfaces/Payload';

export interface MicrosoftUser extends Payload {
  data: {
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
  };
}
