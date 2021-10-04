export interface Template{
    
    name: string;
    id: string; // slug at mandrill, id at 
    createdAt:string;
    versions: {
        name:string;
        id:string;
        subject:string;
        content:string;
        active:boolean;
        updatedAt:string; // h Date type
    }[];
    
}