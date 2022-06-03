export interface Payload<T> {
  id: string;
  email?: string;
  data: T;
}
