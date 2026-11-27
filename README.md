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
3. Click **Transmit to \<server\>** (or **Cmd+Enter**)
4. The remote file path is copied to your clipboard
5. Paste the path into your remote Claude Code session

You can also transmit the current clipboard image from anywhere using the **Quick transmit** shortcut in the bottom-left rail footer (default **Cmd+Option+Ctrl+P**). Click the shortcut pill to record a new key combination, press **Esc** to cancel, or click **reset** while recording to restore the default.

### Keyboard shortcuts

On Windows and Linux, use **Ctrl** in place of **Cmd**.

| Shortcut | Action |
|----------|--------|
| **Cmd+V** | Paste an image from the clipboard |
| **Cmd+Enter** | Transmit the staged image |
| **Cmd+1**–**Cmd+9** | Switch the target server |
| **Cmd+E** | Edit the target server |
| **Up** / **Down** | Walk recent transmissions |
| **Enter** | Copy the shown transmission path |
| **Backspace** / **Delete** | Remove the staged image |
| **Esc** | Return to compose |

## Configuration

Click **Add server** or **+**, then **Copy setup prompt**. Paste it into a coding agent running on the computer where Image Mule is installed. The prompt asks the agent to suggest servers from your recent SSH commands and saved aliases. Pick one and the agent uses this installation's CLI to configure it. Agent setup supports direct SFTP connections.

You can also choose **Enter details manually**. An amber dot in the left rail marks the active upload target. Click a server to switch targets, or click **Edit** (or press **Cmd+E** for the active server) to change these settings. Edits save as you type.

| Field | Description |
|-------|-------------|
| Name | Label shown in the rail and Transmit button |
| Host | SSH hostname or IP |
| Port | SSH port (default: 22) |
| User | SSH username |
| SSH auth | Use **SSH agent** or pick a private **Key file** via **Choose…** (default `~/.ssh/id_rsa`) |
| Remote folder | Where screenshots land on the server |

Click **Test connection** to verify the server you're editing without changing the active target. **Delete server** confirms in place with a second click (**Confirm delete**).

Use Node.js 24 for development. Settings persist between sessions.

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

Your last 100 transmissions appear in the **Recent** section of the left rail. Click any row (or use **Up** / **Down** arrow keys) to view its preview and remote path, then click **Copy path** (or press **Enter**) to copy the path to your clipboard. Press **Esc** to return to compose. Click **Clear** and then **Clear all?** to remove stored history.

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

Choose **SSH agent** for passphrase-protected keys, or **Key file → Choose…** for a private key file. The app uses the agent visible to its process. Legacy password authentication is retired. Upgrading removes saved passwords and keeps the other server settings.

Choose a remote folder under your own home directory. The app sends PNGs directly from memory. It requests owner-only permissions for new folders and files on POSIX servers. Paths with shell-special characters are quoted for pasting into a POSIX shell.

History retains paths, hosts, server names, and timestamps in the local settings file. Thumbnails are encrypted using Electron's OS-backed secret storage. When secure storage is unavailable, the app keeps metadata only. The upgrade also applies this rule to existing previews. **Clear → Clear all?** removes the stored history.

Use **Image Mule → Check for Updates…** on macOS (**Help → Check for Updates…** on Windows and Linux) to open the latest GitHub release. Install updates manually.

## Release signing

The tag workflow requires repository secrets `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` for a Developer ID Application certificate, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for notarization, and `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for the Windows signing certificate. Certificate links can contain base64-encoded PKCS#12 data. The workflow checks the app signatures and notarization before publishing installers and SHA-256 checksums. Local builds can run without distribution credentials.
