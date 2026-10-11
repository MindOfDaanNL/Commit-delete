# Commit-delete
MindDev
Reset the Git history of a repository while keeping the current files intact.

Commit-delete is a lightweight, dependency-free Node.js CLI tool that replaces
the entire Git history of the current repository with a single `initial release`
commit and force-pushes the result to `origin/master`.

> ⚠️ **WARNING: This tool is destructive.** It permanently deletes the existing
> Git history of the repository and force-pushes the new history. Other users
> working on the repository may need to re-clone or reset their local copy.

## Usage

```sh
cd my-project
commit-delete
```

The CLI:

1. Verifies Git is installed.
2. Verifies the current directory is a Git repository.
3. Shows the repository information (path, branch, remote, remote URL, commit count).
4. In an interactive terminal, lets you pick the target branch, remote and commit message.
5. Shows a clear warning and a configuration preview.
6. Asks for confirmation — **No is the default**.
7. On confirmation, executes:

```sh
git checkout --orphan latest_branch
git add -A
git commit -am "<message>"
git branch -D <old-branch>
git branch -M <target-branch>
git push -f <remote> <target-branch>
```

## Authentication

Commit-delete can store GitHub accounts for API operations (creating remotes, managing repos, etc.).

### Add an account

```sh
# Interactive — choose between token or device flow
commit-delete auth add

# With a Personal Access Token
commit-delete auth add --token ghp_your_token_here

# With Device Flow (no token needed)
commit-delete auth add --device
```

### List accounts

```sh
commit-delete auth list
```

### Remove an account

```sh
commit-delete auth remove <username>
```

### Set active account

```sh
commit-delete auth use <username>
```

### Check auth status

```sh
commit-delete auth status
```

### Authentication methods

| Method | Description |
|--------|-------------|
| **Personal Access Token** | Create a token at [GitHub Settings → Tokens](https://github.com/settings/tokens). Requires `repo` scope. |
| **Device Flow** | The CLI shows a code and URL. Go to [github.com/login/device](https://github.com/login/device) and enter the code. No token needed. |

Credentials are stored encrypted in `~/.commit-delete/credentials.json`.

## Options

| Flag | Description |
|------|-------------|
| `-b, --branch <name>` | Target branch (default: current branch) |
| `-r, --remote <name>` | Remote to push to (default: `origin`) |
| `-m, --message <text>` | Commit message (default: `initial release`) |
| `-y, --yes` | Skip the confirmation prompt |
| `-n, --dry-run` | Show the commands without executing them |
| `-h, --help` | Show this help |

When stdin is not a terminal (for example in scripts or CI), the branch, remote
and commit message default to the current branch, `origin` and `initial release`,
and can be overridden with the flags above.

## Installation

### Globally via npm

```sh
npm install -g commit-delete
```

### From source

```sh
npm install
npm link
commit-delete
```

## Development

```sh
npm test
```

Tests create temporary Git repositories (including a bare remote) and verify
the full flow end-to-end.

## How it works

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

## Requirements

- Node.js 18+
- Git
- A valid Git repository
- A remote to push to (default `origin`)
- Permission to force-push to the remote

## Error handling

Every Git command is checked for failure. If a command fails, Commit-delete
stops, shows the failed command and the Git error, and exits with a non-zero
exit code.

If the local history was rewritten but the remote push fails (for example when
`origin` is missing or push permission is denied), the CLI clearly states that
the local repository is using the new history and that the push must be done
manually.

## Safety

- The tool never initializes a Git repository automatically.
- It never deletes project files.
- It never asks for Git credentials — authentication is left to Git itself.
- The confirmation happens before any repository state is changed.

## License

[MIT](LICENSE)