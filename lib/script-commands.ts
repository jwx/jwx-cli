import Project from './project';

export default function () {
    const json: any = Project.loadPackageJson();
    if (!json) {
        return null;
    }
    const scripts = json.scripts;
    const commands = {};
    for (const script in scripts) {
        const args = scripts[script].split(/("[^"]*"|'[^']*'|[\S]+)+/).filter(v => v.trim().length);
        commands[script] = {
            cmd: 'npm',
            args: ['run', script],
            script: args.join(' '),
            passThroughArgs: true,
        }
    }
    return commands;
}
