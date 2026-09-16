declare module 'nodemailer-mandrill-transport' {
  function mandrillTransport(options: { auth: { apiKey: string } }): any;

  export default mandrillTransport;
}
