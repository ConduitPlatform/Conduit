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
        active: boolean;
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

export interface TemplateVersion {
  name: string;
  id: string;
  subject?: string;
  body: string;
  active: boolean;
  updatedAt: string;
  variables?: string[];
}

export interface Template {
  name: string;
  id: string;
  createdAt: string;
  versions: TemplateVersion[];
}
