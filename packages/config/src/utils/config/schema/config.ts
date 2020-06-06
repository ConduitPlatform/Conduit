import {ConduitSchema, TYPE} from '@conduit/sdk';

export default new ConduitSchema('Config', {
    _id: TYPE.ObjectId,
    moduleConfigs: {
        type: TYPE.JSON,
        default: {}
    }

}, {systemRequired: true, timestamps: true});
