import Commands from './commands';
import ScriptCommands from './script-commands';

export default function (cmd, args) {
    const commands = makeCommands(Commands, ScriptCommands());
    const command = findCommand(cmd, commands);
    if (command.passThroughArgs) {
        command.args = [...command.args, ...args];
    }
    return { cmd: command.cmd, args: command.args };
};

function makeCommands(commands, scriptCommands) {
    let cmds = {};
    for (let cmd in commands) {
        const command = commands[cmd];
        if (!command.requiresProject || !!scriptCommands) {
            cmds[cmd] = command;
        }
    }
    return { ...cmds, ...scriptCommands };
}

function findCommand(cmd, commands) {
    let command = { ...commands[cmd] };
    if (!command || !command.cmd) {
        command = {
            ...commands['help'],
            ...{ passThroughArgs: false }
        };
    }
    return command;
}
