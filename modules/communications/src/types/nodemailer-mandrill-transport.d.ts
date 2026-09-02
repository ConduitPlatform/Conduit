declare module 'nodemailer-mandrill-transport' {
  import type { Transport } from 'nodemailer';

  interface MandrillTransportOptions {
    auth: {
      apiKey: string;
    };
  }

  function mandrillTransport(options: MandrillTransportOptions): Transport;

  export default mandrillTransport;
}
