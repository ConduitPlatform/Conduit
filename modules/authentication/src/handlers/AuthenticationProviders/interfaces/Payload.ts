export interface Payload {
  id: string;
  email?: string;
  data: { [field: string]: any };
}
