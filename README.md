# Image Mule 🫏

Share screenshots from your laptop to your Claude Code session on a remote server in one click.

Paste a screenshot, hit transmit. The file lands on your server via SFTP and the remote path is copied to your clipboard.

## Install

Download the latest `.dmg` from [Releases](https://github.com/palpen/image-mule/releases), or build from source:

```bash
git clone https://github.com/palpen/image-mule.git
cd image-mule
npm ci
npm start
```

## Usage

1. Take a screenshot on your laptop
2. **Cmd+V** to paste it into Image Mule (or drag and drop)
3. Click **Transmit and Copy File Path** (or **Cmd+Enter**)
4. The remote file path is copied to your clipboard
5. Paste the path into your remote Claude Code session

## Configuration

Click **Server Settings** to expand the connection panel. On first launch, fill in your server details:

| Field | Description |
|-------|-------------|
| Server | SSH hostname or IP |
| User | SSH username |
| Port | SSH port (default: 22) |
| SSH Key | Select a private key file (default `~/.ssh/id_rsa`) or use your SSH agent |
| Remote Folder | Where screenshots land on the server |

Use Node.js 24 for development. Settings are persisted between sessions and the panel stays collapsed once configured.

### Configure from the terminal

The installed executable accepts a `config` command. It uses the current OS user's Image Mule settings and works with the window open or closed. On macOS, run:

```sh
"/Applications/Image Mule.app/Contents/MacOS/Image Mule" config show
```

For a short command that scripts and agents can find, symlink that executable to `image-mule` in a directory on your `PATH`. On Linux, use the AppImage the same way. On Windows, the installed `image-mule.cmd` launcher beside the executable is for commands you type yourself. From a source checkout, use `npm run --silent config -- show`.

```sh
image-mule config server add Devbox --host devbox.example.com --user ada --ssh-agent
image-mule config server update Devbox --remote-folder /home/ada/screenshots
image-mule config server use Devbox
image-mule config set shortcut CommandOrControl+Shift+P
image-mule config set skip-quick-confirm false
image-mule config show
```

Adding a server selects it. Updates change only the supplied fields. You can pass a server ID from `config show` wherever the examples use a name. To use a specific SSH key, pass `--key` with the path of a local key file. Image Mule still asks you to verify a new host on first connection. The desktop app checks shortcut availability when it registers the shortcut. If it cannot register a shortcut set from the terminal, it restores the previous one.

Scripts and agents should start the executable itself with an argument array, not a shell string and not the Windows launcher, which passes its arguments back through `cmd.exe`. Write values that come from elsewhere as `--option=value`, and put `--` before a server name. The installed app refuses a `config` command that carries options it does not define, including Chromium switches.

`config show` reads existing settings without upgrading them. On an older install, the first command that changes settings runs the same migration as opening the upgraded desktop app, including removal of legacy saved passwords.

Commands print JSON to stdout. Errors go to stderr and return a nonzero exit code. Run `image-mule config --help` for the full command list.

## History

Switch to the **History** tab to see your last 100 transmissions. Each entry shows the filename, server, and timestamp. Click **Copy Path** to copy any previous remote path to your clipboard.

## Build

Package for distribution:

```bash
npm run build
```

Produces platform-specific installers in `dist/`. Packaging uses the SSH library’s JavaScript fallback and Node crypto. The two optional native accelerators are excluded because their bindings are incompatible with this Electron version.

## License

MIT

## Connection security and updates

On the first connection to each host and port, compare the fingerprint in the native approval dialog with one obtained from your server administrator over a trusted channel. On an OpenSSH server the administrator can run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` for an Ed25519 host key. A changed key blocks uploads. After verifying a planned key rotation, create a new profile and approve its key.

Choose **Use SSH agent** for passphrase-protected keys, or **Choose key…** for a private key file. The app uses the agent visible to its process. Legacy password authentication is retired. Upgrading removes saved passwords and keeps the other server settings.

Choose a remote folder under your own home directory. The app sends PNGs directly from memory. It requests owner-only permissions for new folders and files on POSIX servers. Paths with shell-special characters are quoted for pasting into a POSIX shell.

History retains paths, hosts and timestamps in the local settings file. Thumbnails are encrypted using Electron's OS-backed secret storage. When secure storage is unavailable, the app keeps metadata only. The upgrade also applies this rule to existing previews. **Clear → All History** removes the stored history.

Use **Server Settings → Check for updates** to open the latest GitHub release. Install updates manually.

## Release signing

The tag workflow requires repository secrets `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` for a Developer ID Application certificate, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for notarization, and `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for the Windows signing certificate. Certificate links can contain base64-encoded PKCS#12 data. The workflow checks the app signatures and notarization before publishing installers and SHA-256 checksums. Local builds can run without distribution credentials.
