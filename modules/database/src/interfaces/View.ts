export interface IView {
  _id: string;
  name: string;
  originalSchema: string;
  joinedSchemas: string[];
  query: JSON;
}
