class ConduitStringConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return 'String'
    }

    static get Required() {
        return {type: 'String', required: true}
    }
}


export let ConduitString = ConduitStringConstructor;

class ConduitNumberConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return 'Number'
    }

    static get Required() {
        return {type: 'Number', required: true}
    }
}


export let ConduitNumber = ConduitNumberConstructor;
