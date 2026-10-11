<div align="center">

![Commit-delete Banner](https://img.shields.io/badge/Commit--delete-Git%20History%20Reset-6C63FF?style=for-the-badge&logo=git&logoColor=white)

# 🔄 Commit-delete

[![Version](https://img.shields.io/badge/version-1.0.0-6C63FF?style=flat-square)](https://github.com/MindOfDaanNL/Commit-delete)
[![License](https://img.shields.io/badge/license-MIT-6C63FF?style=flat-square)](https://github.com/MindOfDaanNL/Commit-delete/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-18%20passing-success?style=flat-square)](https://github.com/MindOfDaanNL/Commit-delete)

> Reset the Git history of a repository while keeping the current files intact  
> Built with 💜 by [MindOfDaanNL](https://github.com/MindOfDaanNL)

[Installation](#-installation) · [Usage](#-usage) · [Authentication](#-authentication) · [API](#-api) · [Contributing](#-contributing)

---

</div>

## ✨ Features

- 🔄 **One-command reset** — Replace entire Git history with a single commit
- 📁 **Files preserved** — Your working directory stays untouched
- 🔐 **GitHub auth** — Store accounts via Personal Access Token or Device Flow
- 🎯 **Interactive CLI** — Beautiful prompts with branch/remote/message selection
- 🛡️ **Safe by default** — Confirmation required, No is the default
- 🧪 **Well tested** — 18 integration tests covering the full flow
- 📦 **Zero dependencies** — Uses only Node.js built-ins
- 🔧 **Flexible** — Flags for branch, remote, message, dry-run, and more

---

## 📸 Preview

```text
   ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗
  ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝
  ██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║
  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║
  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║
   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝

  COMMIT-DELETE v1.0.0  · Git history reset utility
```

---

## 🚀 Installation

### From npm (recommended)

```bash
npm install -g commit-delete
```

### From source

```bash
git clone https://github.com/MindOfDaanNL/Commit-delete.git
cd Commit-delete
npm install
npm link
```

---

## ⚡ Quick Start

```bash
cd my-project
commit-delete
```

That's it! The CLI will guide you through the process.

---

## 📖 Usage

### Basic usage

```bash
cd my-project
commit-delete
```

The CLI will:

1. Verify Git is installed
2. Verify you're in a Git repository
3. Show repository information
4. Let you pick branch, remote, and commit message (interactive)
5. Show a warning and configuration preview
6. Ask for confirmation — **No is the default**
7. Execute the reset and force-push

### Command-line options

| Flag | Description |
|------|-------------|
| `-b, --branch <name>` | Target branch (default: current branch) |
| `-r, --remote <name>` | Remote to push to (default: `origin`) |
| `-m, --message <text>` | Commit message (default: `initial release`) |
| `-y, --yes` | Skip the confirmation prompt |
| `-n, --dry-run` | Show commands without executing them |
| `-h, --help` | Show help |

### Examples

```bash
# Reset with custom branch and message
commit-delete --branch main --message "fresh start"

# Dry run — see what would happen
commit-delete --dry-run

# Non-interactive (CI/CD)
commit-delete --branch main --remote origin --message "initial release" --yes
```

---

## 🔐 Authentication

Commit-delete can store GitHub accounts for API operations.

### Add an account

```bash
# Interactive — choose between token or device flow
commit-delete auth add

# With a Personal Access Token
commit-delete auth add --token ghp_your_token_here

# With Device Flow (no token needed)
commit-delete auth add --device
```

### Manage accounts

```bash
# List all accounts
commit-delete auth list

# Set active account
commit-delete auth use <username>

# Remove an account
commit-delete auth remove <username>

# Check auth status
commit-delete auth status
```

### Authentication methods

| Method | Description |
|--------|-------------|
| **Personal Access Token** | Create a token at [GitHub Settings → Tokens](https://github.com/settings/tokens). Requires `repo` scope. |
| **Device Flow** | The CLI shows a code and URL. Go to [github.com/login/device](https://github.com/login/device) and enter the code. No token needed. |

Credentials are stored encrypted in `~/.commit-delete/credentials.json`.

---

## 🔧 How It Works

Before the operation:

```text
commit A
   ↓
commit B
   ↓
commit C
```

After `commit-delete`:

```text
initial release
```

The current files are preserved. Only the history is rewritten.

### Execution steps

```bash
git checkout --orphan latest_branch
git add -A
git commit -am "<message>"
git branch -D <old-branch>
git branch -M <target-branch>
git push -f <remote> <target-branch>
```

---

## 📁 Project Structure

```
Commit-delete/
├── 📁 src/
│   ├── 📄 index.js          # CLI entry point
│   ├── 📄 cli.js            # Interactive UI (prompts, banners, colors)
│   ├── 📄 git.js            # Git command execution + GitHub API
│   ├── 📄 auth.js           # Account management + encryption
│   └── 📄 utils.js          # Color, box, and formatting helpers
├── 📁 test/
│   ├── 📄 git.test.js       # Unit tests for git module
│   └── 📄 integration.test.js # End-to-end CLI tests
├── 📄 package.json
├── 📄 README.md
└── 📄 LICENSE
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logo.js&logoColor=white) | Runtime |
| ![Git](https://img.shields.io/badge/Git-F05032?logo=git&logoColor=white) | Version control |
| ![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white) | Package management |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

Tests create temporary Git repositories (including a bare remote) and verify the full flow end-to-end.

---

## 📋 Changelog

See the full changelog: [📄 Changelog](https://github.com/MindOfDaanNL/Projecten/blob/main/Changelogs/Commit-delete.md)

### Latest Release

#### `v1.0.0` — October 11, 2026
- 🎉 Initial release
- Interactive CLI with branch/remote/message selection
- GitHub authentication (token + device flow)
- Encrypted credential storage
- Dry-run mode
- Full test coverage

---

## 🤝 Contributing

Contributions are welcome! Please see the [Contributing Guide](https://github.com/MindOfDaanNL/Projecten) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📜 License

[MIT](LICENSE) © [MindOfDaanNL](https://github.com/MindOfDaanNL)

---

<div align="center">

⭐ **Star Commit-delete if you find it useful!** ⭐

[⬆ Back to Top](#-commit-delete)

<sub>Made with ❤️ by [MindOfDaanNL](https://github.com/MindOfDaanNL)

</div>
