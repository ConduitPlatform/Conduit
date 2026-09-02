declare module '@mailchimp/mailchimp_transactional' {
  interface MailchimpTransactional {
    templates: {
      list(body: Record<string, unknown>): Promise<unknown>;
      info(body: { name: string }): Promise<unknown>;
      add(body: {
        name: string;
        subject?: string;
        code?: string;
        publish?: boolean;
      }): Promise<{ slug: string }>;
      update(body: {
        name: string;
        code?: string;
        subject?: string;
      }): Promise<{ slug: string }>;
      delete(body: { name: string }): Promise<unknown>;
    };
    messages: {
      info(body: { id: string }): Promise<unknown>;
    };
  }

  function mailchimpFactory(apiKey: string): MailchimpTransactional;

  export default mailchimpFactory;
}
