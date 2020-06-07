import Commands from './commands';
import ScriptCommands from './script-commands';
import Helps from './helps';

export default function (command, args) {
    const commands = makeHelps(Commands, ScriptCommands(), Helps);

    console.log('Aurelia CLI');

    if (args && args.length) {
        const cmd = args[0];
        outputHelp(cmd, commands[cmd].help);
    } else {
        const sortedCommands = Object.keys(commands);
        sortedCommands.sort((a, b) =>
            (commands[a].scriptHelp ? 1 : 0) - (commands[b].scriptHelp ? 1 : 0)
            || (a < b ? -1 : 1)
        );
        for (const cmd of sortedCommands) {
            outputHelp(cmd, commands[cmd].help);
        }
    }
};

function outputHelp(cmd, help) {
    const mainPad = 3;
    let out = "\n" + ''.padEnd(mainPad) + `${cmd}\n`;
    if (help.description) {
        const descriptions = help.description.split('\n');
        for (const description of descriptions) {
          out += ''.padEnd(mainPad * 2) + `${description}\n`;
        }
    }
    if (help.args && help.args.length) {
        const pad = Math.max(...help.args.map(arg => Object.keys(arg)[0].length));
        let args = [];
        for (const arg of help.args) {
            const [name, desc] = [Object.keys(arg)[0], Object.values(arg)[0]];
            args.push(`${name.padEnd(pad)} - ${desc}`);
        }
        const padding = '\n' +''.padEnd(mainPad * 2);
        out +=  `${padding}${args.join(padding)}\n`;
    }
    console.log(out.trimRight());
}

function makeHelps(commands, scriptCommands, helps) {
    const result = {};
    for (const cmd in commands) {
        const command = commands[cmd];
        if (!command.requiresProject || !!scriptCommands) {
            command.cmd = cmd;
            command.help = helps[cmd] || {};
            result[cmd] = command;
        }
    }
    for (const cmd in scriptCommands) {
        if (result[cmd]) {
            continue;
        }
        const command = scriptCommands[cmd];
        command.cmd = cmd;
        command.help = helps[cmd];
        if (!command.help) {
            command.help = makeScriptHelp(scriptCommands[cmd]);
            command.scriptHelp = true;
        } else {
          command.help.description = (command.help.description || '') + '\n' + makeScriptHelp(scriptCommands[cmd]).description;
        }
        result[cmd] = command;
    }
    return result;
}

function makeScriptHelp(cmd) {
    return { description: `npm script: ${cmd.script}` };
}
