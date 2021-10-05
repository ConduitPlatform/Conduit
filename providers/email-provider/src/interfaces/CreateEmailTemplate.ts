export interface CreateEmailTemplate{
    
    name:string;
    htmlContent?:string;
    plainContent?:string;
    subject?:string;
    versionName?: string;
    active?:boolean;
    
}