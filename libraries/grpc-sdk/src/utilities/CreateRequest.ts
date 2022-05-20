import { CreateFileRequest, DeepPartial } from '../protoUtils/storage';

export async function* createRequest(request:CreateFileRequest ): AsyncIterable<DeepPartial<CreateFileRequest>> {
  let i = 0;
  while (i < 10) {
    yield request
    await new Promise(resolve => setTimeout(resolve, 50));
    i++;
  }
}