const { parseArgs } = require('node:util');
const { profileFields, publicProfile, validKeyPath, validShortcut } = require('./validation');

const help = `Usage: image-mule config <command>

  show                              Print profiles, active server ID and preferences as JSON
  server add NAME [options]         Create a profile and select it
  server update ID|NAME [options]   Change only the supplied fields
  server use ID|NAME                Select the active profile
  server remove ID|NAME             Delete a profile
  set shortcut ACCELERATOR          Set the global transmit shortcut
  set skip-quick-confirm true|false Set the quick transmit confirmation preference

Profile options: --name (update only), --host, --port, --user, --remote-folder,
                 --key PATH or --ssh-agent. Key paths must be local and absolute or start with ~/.
Use an ID when names are duplicated. Successful commands print JSON.`;

const profileOptions = {
  name: { type: 'string' }, host: { type: 'string' }, port: { type: 'string' },
  user: { type: 'string' }, 'remote-folder': { type: 'string' },
  key: { type: 'string' }, 'ssh-agent': { type: 'boolean' }
};
const ownSwitches = new Set(['--help', '-h', ...Object.keys(profileOptions).map(name => '--' + name)]);

function unexpectedSwitch(args) {
  const terminator = args.indexOf('--');
  const beforeTerminator = terminator === -1 ? args : args.slice(0, terminator);
  return beforeTerminator.find(arg => arg.startsWith('-') && !ownSwitches.has(arg.split('=', 1)[0]));
}

function findServer(servers, ref) {
  const byId = servers.find(server => server.id === ref);
  if (byId) return byId;
  const matches = servers.filter(server => server.name === ref);
  if (matches.length === 0) throw new Error('Unknown server: ' + ref);
  if (matches.length > 1) throw new Error('Multiple servers have that name. Use an ID from config show.');
  return matches[0];
}

function serverCommand(action, args) {
  const edit = action === 'add' || action === 'update';
  if (!edit && action !== 'use' && action !== 'remove') throw new Error(help);
  const { values, positionals } = parseArgs({ args, options: edit ? profileOptions : {}, allowPositionals: true });
  if (positionals.length !== 1 || !positionals[0].trim()) throw new Error(help);
  const [ref] = positionals;
  if (!edit) return { action, ref };

  if (action === 'add' && values.name !== undefined) throw new Error('Supply the new server name after add.');
  if (action === 'update' && !Object.keys(values).length) throw new Error('Supply at least one profile option.');
  const key = values.key;
  if (key !== undefined && (values['ssh-agent'] || !validKeyPath(key))) {
    throw new Error('Choose either --ssh-agent or --key with a local absolute path or ~/ path.');
  }
  if (values.port !== undefined && !/^\d+$/.test(values.port)) throw new Error('Invalid server setting: port.');
  const fields = { ...values };
  if (action === 'add') fields.name = ref;
  if (values.port !== undefined) fields.port = Number(values.port);
  if (values.user !== undefined) fields.username = values.user;
  if (values['remote-folder'] !== undefined) fields.remotePath = values['remote-folder'];
  if (values['ssh-agent']) fields.useAgent = true;
  const patch = profileFields(fields);
  return { action, ref, fields: patch, keyFile: key };
}

function parseCommand(args) {
  const [verb, target, ...rest] = args;
  if (!args.length || (args.length === 1 && ['--help', '-h', 'help'].includes(verb))) return null;
  if (verb === 'show' && args.length === 1) return { action: 'show' };
  if (verb === 'server') return serverCommand(target, rest);
  if (verb === 'set' && rest.length === 1) {
    const [value] = rest;
    if (target === 'shortcut') {
      if (!validShortcut(value)) throw new Error('Invalid shortcut. Example: CommandOrControl+Shift+P.');
      return { action: 'shortcut', value };
    }
    if (target === 'skip-quick-confirm') {
      if (!['true', 'false'].includes(value)) throw new Error('Expected true or false.');
      return { action: 'skip-quick-confirm', value: value === 'true' };
    }
  }
  throw new Error(help);
}

function withKeyFile(config, server, keyFile) {
  return server && keyFile !== undefined ? config.setKeyFile(server.id, keyFile) : server;
}

function runCommand(config, command) {
  const { action, ref, fields, keyFile, value } = command;
  if (action === 'show') return config.getSettings();
  const id = ['update', 'use', 'remove'].includes(action) ? findServer(config.getSettings().servers, ref).id : null;
  config.migrateIfNeeded();
  switch (action) {
    case 'add': return publicProfile(withKeyFile(config, config.addServer(fields), keyFile));
    case 'update': return publicProfile(withKeyFile(config, config.updateServer(id, fields), keyFile));
    case 'use':
      config.setActiveServer(id);
      return { id, activeServerId: id };
    case 'remove':
      config.deleteServer(id);
      return { id, activeServerId: config.getActiveServer()?.id ?? null };
    case 'shortcut':
      config.setGlobalShortcut(value);
      return { globalShortcut: value };
    case 'skip-quick-confirm':
      config.setSkipQuickConfirm(value);
      return { skipQuickConfirm: value };
    default: throw new Error(help);
  }
}

module.exports = { help, parseCommand, runCommand, unexpectedSwitch };
