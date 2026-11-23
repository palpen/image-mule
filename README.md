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
