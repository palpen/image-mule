# Image Mule 🫏

Share screenshots from your laptop to your Claude Code session on a remote server in one click.

Paste a screenshot, hit send. The file lands on your server via SFTP and the remote path is copied to your clipboard.

## Install

```bash
git clone https://github.com/palpen/image-mule.git
cd image-mule
npm install
npm start
```

## Usage

1. Take a screenshot on your laptop
2. **Cmd+V** to paste it into Image Mule (or drag and drop)
3. Configure your server connection (saved automatically)
4. Click **Send to Server** (or **Cmd+Enter**)
5. The remote file path is copied to your clipboard
6. Paste the path into your remote Claude Code session

## Configuration

On first launch, fill in your server details:

| Field | Description |
|-------|-------------|
| Server | SSH hostname or IP |
| User | SSH username |
| Port | SSH port (default: 22) |
| SSH Key | Path to private key (default: `~/.ssh/id_rsa`) |
| Remote Folder | Where screenshots land on the server |

Settings are persisted between sessions.

## Build

Package for distribution:

```bash
npm run build
```

Produces platform-specific installers in `dist/`.

## License

MIT
