export default function () {
    const args = process.argv;
    if (args.length < 3) {
        return { cmd: 'help', args: [] };
    }
    return { cmd: args[2], args: args.slice(3) };
};
