export interface CreateMailgunTemplate{
    name:string; 
    description:string;
    template?:string;  // version is created when this property exists
    tag?:string;
    engine?:string;
    comment?:string // version comment

}