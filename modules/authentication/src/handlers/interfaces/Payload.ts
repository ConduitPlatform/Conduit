import { User } from '../../models';

export interface Payload {
  id: string;
  email?:string;
  [field: string]:any;
}