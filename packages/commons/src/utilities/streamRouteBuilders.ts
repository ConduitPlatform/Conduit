import { ConduitStreamRouteParameters, StreamIterable } from '@conduitplatform/grpc-sdk';
import fs from 'fs';

export async function * buildStreamFileIterable(request: ConduitStreamRouteParameters): StreamIterable {
  yield {
    info: {
      params: request.params ?? {},
      path: request.path ?? '', // TODO: How is this even optional? Fix og type?
      headers: request.headers,
      context: {
        ...(request.context),
        name: request.data.file.originalname,
        mimeType: request.data.file.mimetype,
      },
    },
    chunk: undefined,
  };
  // TEST
  const readFile = fs.readFileSync(request.data.file.path);
  const chunkSize = 1024 * 1024;
  const chunksN = Math.ceil(request.data.file.size / chunkSize);
  let i = 0;
  console.log('file size..', request.data.file.size);
  console.log('chunks...', chunksN);
  while (i <= chunksN) {
    const offset = i * chunkSize;
    console.log('current chunk..', i);
    console.log('offset...', i * chunkSize);
    console.log('file blob from offset...', offset);
    const chunk = readFile.slice(offset, offset + chunkSize);
    console.log(chunk);
    yield {
      info: undefined,
      chunk: Buffer.from(readFile),
    };
    i++;
  }
}
