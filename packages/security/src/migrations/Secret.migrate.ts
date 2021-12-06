import { Client } from '../models';
import * as bcrypt from 'bcrypt';

export async function secretMigrate() {
  let clients: {
    _id: string;
    clientSecret: string;
  }[] = await Client.getInstance().findMany(
    {
      clientSecret: {
        $not: {
          $regex: '$2b.*',
        },
      },
    },
    'clientSecret'
  );
  if (clients.length === 0) return;
  for (let client of clients) {
    let hash = await bcrypt.hash(client.clientSecret, 10);
    await Client.getInstance().findByIdAndUpdate(
      client._id,
      { clientSecret: hash },
      true
    );
  }
}
