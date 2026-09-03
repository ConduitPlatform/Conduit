declare module '@mailchimp/mailchimp_transactional' {
  interface MailchimpTransactional {
    templates: {
      list(body?: Record<string, unknown>): Promise<any>;
      info(body: { name: string }): Promise<any>;
      add(body: {
        name: string;
        subject?: string;
        code?: string;
        publish?: boolean;
      }): Promise<any>;
      update(body: { name: string; code?: string; subject?: string }): Promise<any>;
      delete(body: { name: string }): Promise<any>;
    };
    messages: {
      info(body: { id: string }): Promise<any>;
    };
  }

  function mailchimpFactory(apiKey: string): MailchimpTransactional;

  export default mailchimpFactory;
}
