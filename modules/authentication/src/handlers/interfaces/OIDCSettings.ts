export class OIDCSettings {
    private options: any;

    constructor(options: any,state: string = 'state') {
        options['state'] = state;
        this.options = options;
    }

    get getOptions() { return  this.options; }
};