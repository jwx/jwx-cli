import args from './args';
import command from './command';
import run from './run';
import help from './help';

async function jwx1() {
    const input = args();
    const cmd = command(input.cmd, input.args);
    if (cmd.cmd === 'help') {
        help(cmd.cmd, cmd.args);
    } else {
       await run(cmd.cmd, cmd.args);
    }
}

module.exports = jwx1;
