export interface SengridTemplateVersion{

    name: string;
    subject: string;
    active?: 0|1;
    html_content?:string;
    plain_content?:string;
    generate_plain_content?:string;
    editor?:string;
    test_data?:string;
}