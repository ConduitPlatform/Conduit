export type RouterRequest = {
  request: {
    params: string,
    path: string,
    headers: string,
    context: string
  }
};

type Response = { result: string, redirect: string };
type ResponseWithResult = { result: string };
type ResponseWithRedirect = { redirect: string };

export type RouterResponse = (
  err: {
    code: number,
    message: string
  } | null,
  res?: Response | ResponseWithResult | ResponseWithRedirect
) => void;
