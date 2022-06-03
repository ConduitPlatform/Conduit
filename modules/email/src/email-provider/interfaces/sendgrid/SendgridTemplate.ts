export interface SendgridTemplate {
  body: {
    id: string;
    name: string;
    generation: string;
    updated_at: string;
    versions: [
      {
        // versions not supported at sendgrid
        id: string;
        user_id: number;
        template_id: string;
        active: number;
        name: string;
        html_content: string;
        plain_content: string;
        generate_plain_content: boolean;
        subject: string;
        editor: string;
        updated_at: string;
        thumbnail_url: string;
      },
    ];
  };
}
