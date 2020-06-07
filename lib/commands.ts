export default {
    new: {
        cmd: 'npx',
        args: ['makes', 'aurelia'],
        passThroughArgs: true,
        requiresProject: false,
    },
    help: {
        cmd: 'help',
        args: [],
        passThroughArgs: true,
        requiresProject: false,
    },
    localize: {
        cmd: 'npm',
        args: ['install', '--save-dev', 'jwx-'],
        passThroughArgs: false,
        requiresProject: true,
    },
    globalize: {
        cmd: 'npm',
        args: ['install', '-g', 'jwx-'],
        passThroughArgs: false,
        requiresProject: false,
    },
};
