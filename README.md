# Image Mule 🫏

Share screenshots from your laptop to your Claude Code session on a remote server in one click.

Paste a screenshot, hit transmit. The file lands on your server via SFTP and the remote path is copied to your clipboard.

## Install

Download the latest `.dmg` from [Releases](https://github.com/palpen/image-mule/releases), or build from source:

```bash
git clone https://github.com/palpen/image-mule.git
cd image-mule
npm install
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
| SSH Key | Path to private key (default: `~/.ssh/id_rsa`) |
| Remote Folder | Where screenshots land on the server |

Settings are persisted between sessions and the panel stays collapsed once configured.

## History

Switch to the **History** tab to see your last 100 transmissions. Each entry shows the filename, server, and timestamp. Click **Copy Path** to copy any previous remote path to your clipboard.

## Build

Package for distribution:

```bash
npm run build
```

Produces platform-specific installers in `dist/`.

## License

MIT
