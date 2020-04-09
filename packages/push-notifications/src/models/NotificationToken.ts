import {PlatformTypesEnum} from "@conduit/sdk";

export const NotificationTokenModel = {
    name: 'NotificationToken',
    modelSchema: {
        userId: {
            type: 'Relation',
            model: 'User'
        },
        token: {
            type: String,
            required: true
        },
        platform: {
            type: String,
            // TODO this is temporarily imported from the security module
            // TODO when this is fixed, fix also tsconfig rootDir and package.json index & types
            enum: Object.values(PlatformTypesEnum),
            required: true
        }
    },
    modelOptions: {
        timestamps: true
    }
};
