import cp from 'child_process';
import path from 'path';
import fs from 'fs';

const isWin = process.platform === 'win32';
const isWinLike = process.platform === 'win32' || process.env.OSTYPE === 'cygwin' || process.env.OSTYPE === 'msys';

const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

// See http://www.robvanderwoude.com/escapechars.php
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;

const pathKey = isWin ? Object.keys(process.env).find(x => x.toUpperCase() === 'PATH') || 'Path' : 'PATH';

function escapeArgument(_arg: unknown, doubleEscapeMetaChars: boolean) {
  // Convert to string
  let arg = `${_arg}`;

  // Algorithm below is based on https://qntm.org/cmd

  // Sequence of backslashes followed by a double quote:
  // double up all the backslashes and escape the double quote
  arg = arg.replace(/(\\*)"/g, '$1$1\\"');

  // Sequence of backslashes followed by the end of the string
  // (which will become a double quote later):
  // double up all the backslashes
  arg = arg.replace(/(\\*)$/, '$1$1');

  // All other backslashes occur literally

  // Quote the whole thing:
  arg = `"${arg}"`;

  // Escape meta chars
  arg = arg.replace(metaCharsRegExp, '^$1');

  // Double escape meta chars if necessary
  if (doubleEscapeMetaChars) {
    arg = arg.replace(metaCharsRegExp, '^$1');
  }

  return arg;
}

function isexe(path: string, options: { pathExt?: string }) {
  const stat = fs.statSync(path);

  if (isWin) {
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      return false;
    }

    let pathext = options.pathExt === void 0 ? process.env.PATHEXT : options.pathExt;

    if (!pathext) {
      return true;
    }

    const parts = pathext.split(';');
    if (parts.indexOf('') !== -1) {
      return true;
    }

    for (let i = 0; i < parts.length; ++i) {
      const p = parts[i].toLowerCase();
      if (p.length > 0 && path.slice(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }

  if (stat.isFile()) {
    const mode = stat.mode;
    const uid = stat.uid;
    const gid = stat.gid;

    const myUid = process.getuid();
    const myGid = process.getgid();

    return (
      (mode & 0o001) > 0 ||
      ((mode & 0o010) > 0 && gid === myGid) ||
      ((mode & 0o100) > 0 && uid === myUid) ||
      ((mode & 0o110) > 0 && myUid === 0)
    );
  }

  return false;
}

function which(cmd: string, options: { path?: string; pathExt?: string }) {
  let pathEnv = (options.path || process.env.PATH || '').split(path.delimiter);
  let pathExt = [''];
  let pathExtExe = '';

  if (isWinLike) {
    pathEnv.unshift(process.cwd());
    pathExtExe = options.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM';
    pathExt = pathExtExe.split(path.delimiter);

    // Always test the cmd itself first.  isexe will check to make sure
    // it's found in the pathExt set.
    if (cmd.indexOf('.') !== -1 && pathExt[0] !== '') {
      pathExt.unshift('');
    }
  }

  // If it has a slash, then we don't bother searching the pathenv.
  // just check the file itself, and that's it.
  if (cmd.indexOf('/') !== -1 || (isWinLike && cmd.indexOf('\\') !== -1)) {
    pathEnv = [''];
  }

  for (let i = 0; i < pathEnv.length; ++i) {
    let pathPart = pathEnv[i];
    if (pathPart.charAt(0) === '"' && pathPart.slice(-1) === '"') {
      pathPart = pathPart.slice(1, -1);
    }

    let p = path.join(pathPart, cmd);
    if (!pathPart && cmd.charAt(0) === '.' && (cmd.charAt(1) === '/' || cmd.charAt(1) === '\\')) {
      p = cmd.slice(0, 2) + p;
    }

    for (let j = 0; j < pathExt.length; ++j) {
      const cur = p + pathExt[j];
      try {
        if (isexe(cur, { pathExt: pathExtExe })) {
          return cur;
        }
      } catch {
        // Ignore
      }
    }
  }

  const err = new Error(`not found: ${cmd}`);
  err['code'] = 'ENOENT';

  throw err;
}


function readShebang(command: string) {
  // Read the first 150 bytes from the file
  const size = 150;
  const buffer = Buffer.alloc(size);

  try {
    const fd = fs.openSync(command, 'r');
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
  } catch {
    // Do nothing
  }

  let str = buffer.toString();

  if (str.charAt(0) !== '#' || str.charAt(1) !== '!') {
    return null;
  }

  str = str.charAt(2) === ' ' ? str.slice(3) : str.slice(2);
  const arr = str.split(' ');
  const bin = arr[0].split('/').pop();
  const arg = arr[1];

  return bin === 'env' ? arg : `${bin}${(arg ? ` ${arg}` : '')}`;
}

class SpawnInstruction {
  public args: string[];
  public options: cp.SpawnOptions;
  public file?: string = void 0;
  public original: { command: string; args: string[] };

  constructor(public command: string, args: string[], options: cp.SpawnOptions) {
    this.args = args.slice();
    this.options = { ...options };

    this.original = {
      command,
      args
    };

    if (!options.shell && isWin) {
      // Detect & add support for shebangs
      this.file = this.resolveCommand();

      let commandFile: string;
      const shebang = this.file && readShebang(this.file);
      if (shebang) {
        this.args.unshift(this.file);
        this.command = shebang;

        commandFile = this.resolveCommand();
      } else {
        commandFile = this.file;
      }

      // We don't need a shell if the command filename is an executable
      const needsShell = !isExecutableRegExp.test(commandFile);

      // If a shell is required, use cmd.exe and take care of escaping everything correctly
      // Note that `forceShell` is an hidden option used only in tests
      if (needsShell) {
        // Need to double escape meta chars if the command is a cmd-shim located in `node_modules/.bin/`
        // The cmd-shim simply calls execute the package bin file with NodeJS, proxying any argument
        // Because the escape of metachars with ^ gets interpreted when the cmd.exe is first called,
        // we need to double escape them
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);

        // Normalize posix paths into OS compatible paths (e.g.: foo/bar -> foo\bar)
        // This is necessary otherwise it will always fail with ENOENT in those cases
        this.command = path.normalize(this.command);

        // Escape command & arguments
        this.command = this.command.replace(metaCharsRegExp, '^$1');
        this.args = this.args.map(arg => escapeArgument(arg, needsDoubleEscapeMetaChars));

        const shellCommand = [this.command, ...this.args].join(' ');

        this.args = ['/d', '/s', '/c', `"${shellCommand}"`];
        this.command = process.env.comspec || 'cmd.exe';
        this.options.windowsVerbatimArguments = true; // Tell node's spawn that the arguments are already escaped
      }
    }
  }

  private resolveCommand() {
    return this.resolveCommandAttempt(false) || this.resolveCommandAttempt(true);
  }

  private resolveCommandAttempt(withoutPathExt: boolean) {
    const cwd = process.cwd();
    const hasCustomCwd = this.options.cwd != null;

    // If a custom `cwd` was specified, we need to change the process cwd
    // because `which` will do stat calls but does not support a custom cwd
    if (hasCustomCwd) {
      try {
        process.chdir(this.options.cwd);
      } catch {
        // Ignore
      }
    }

    let resolved: string | undefined;

    try {
      resolved = which(this.command, {
        path: (this.options.env || process.env)[pathKey],
        pathExt: withoutPathExt ? path.delimiter : void 0
      });
    } catch {
      // Ignore
    } finally {
      process.chdir(cwd);
    }

    // If we successfully resolved, ensure that an absolute path is returned
    // Note that when a custom `cwd` was used, we need to resolve to an absolute path based on it
    if (resolved) {
      resolved = path.resolve(hasCustomCwd ? this.options.cwd : '', resolved);
    }

    return resolved;
  }
}

function spawn(command: string, args: string[], options: cp.SpawnOptions) {
  // Parse the arguments
  const parsed = new SpawnInstruction(command, args, options);

  // Spawn the child process
  const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);

  if (isWin) {
    // Hook into child process "exit" event to emit an error if the command
    // does not exists, see: https://github.com/IndigoUnited/node-cross-spawn/issues/16
    const originalEmit = spawned.emit;

    spawned.emit = function emit(event: string, ...args: any[]) {
      if (event === 'exit') {
        if (isWin && args[0] === 1 && !parsed.file) {
          const err = Object.assign(new Error(`spawn ${parsed.original.command} ENOENT`), {
            code: 'ENOENT',
            errno: 'ENOENT',
            syscall: `spawn ${parsed.original.command}`,
            path: parsed.original.command,
            spawnargs: parsed.original.args
          });

          return originalEmit.call(spawned, 'error', err);
        }
      }

      return originalEmit.apply(spawned, args);
    };
  }

  return spawned;
}

export default function(command, args = [], dir = '.') {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', cwd: dir });

    proc.on('error', reject);
    proc.on('exit', (code, signal) => {
      if (code) {
        let message = `${command} exit code: ${code}`;
        if (signal) message += ` signal: ${signal}`;
        reject(new Error(message));
      } else {
        resolve();
      }
    });
  });
}
