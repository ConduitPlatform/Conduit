export interface MailgunTemplate  {
    template: {
        name: string;
        description: string;
        createdAt: any;
        createdBy:any;
        id: any;
        version: {
            tag: string;
            template: string;
            engine: string;
            mjml: string;
            createdAt: string;
            comment: string;
            active: boolean;
            id: string;
        }
    }
    description?: string;
}