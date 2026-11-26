const { app } = require('electron');
const fs = require('node:fs');
const { withSettingsLock } = require('./settings-lock');

const args = process.argv.slice(process.defaultApp ? 2 : 1);
const commandIndex = args.findIndex(arg => !arg.startsWith('-'));
const cli = args[commandIndex] === 'config';
const refusedSwitch = cli && app.isPackaged ? require('./config-cli').unexpectedSwitch(args) : undefined;
if (cli) app.dock?.hide();

async function run() {
  if (cli) {
    const { parseCommand, runCommand, help } = require('./config-cli');
    const command = parseCommand(args.slice(commandIndex + 1));
    if (!command) return help;
    await app.whenReady();
    const result = await withSettingsLock(() => runCommand(require('./config'), command));
    return JSON.stringify(result, null, 2);
  }

  await app.whenReady();
  await withSettingsLock(() => require('./config').migrateIfNeeded());
  require('../main');
}

function printAndExit(stream, text, code) {
  stream.write(text + '\n', () => app.exit(code));
}

function refuseBeforeStartup(option) {
  try {
    fs.writeSync(process.stderr.fd, `Unexpected option: ${option}\n`);
  } finally {
    app.exit(1);
  }
}

if (refusedSwitch) {
  refuseBeforeStartup(refusedSwitch);
} else {
  run().then(output => {
    if (cli) printAndExit(process.stdout, output, 0);
  }).catch(error => printAndExit(process.stderr, error.message, 1));
}
