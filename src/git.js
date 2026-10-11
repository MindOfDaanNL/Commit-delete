'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const auth = require('./auth');

const execFileAsync = promisify(execFile);

// Create a temporary askpass script that outputs the stored token
function createAskpassScript(token) {
  const cacheDir = path.join(__dirname, '.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  }
  const scriptPath = path.join(cacheDir, `askpass-${process.pid}.sh`);
  const script = `#!/bin/sh
case "$1" in
  *Username*) echo "$GIT_USERNAME" ;;
  *Password*) echo "$GIT_PASSWORD" ;;
esac
`;
  fs.writeFileSync(scriptPath, script, { mode: 0o700 });
  return scriptPath;
}

async function run(args, options = {}) {
  const { cwd, maxBuffer } = options;
  
  // Configure git to use stored credentials for push operations
  const env = { ...process.env };
  const activeAccount = auth.getActiveAccount();
  let askpassScript = null;
  
  if (activeAccount && (args[0] === 'push' || args[0] === 'fetch' || args[0] === 'pull')) {
    askpassScript = createAskpassScript(activeAccount.token);
    env.GIT_ASKPASS = askpassScript;
    env.GIT_USERNAME = activeAccount.username;
    env.GIT_PASSWORD = activeAccount.token;
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: maxBuffer || 10 * 1024 * 1024,
      env,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      ok: false,
      code: err.code,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
      message: err.message,
    };
  } finally {
    if (askpassScript) {
      try { fs.unlinkSync(askpassScript); } catch {}
    }
  }
}

async function checkGit(cwd) {
  const result = await run(['--version'], { cwd });
  return result.ok;
}

async function isInsideWorkTree(cwd) {
  const result = await run(['rev-parse', '--is-inside-work-tree'], { cwd });
  return result.ok && result.stdout === 'true';
}

async function getCurrentBranch(cwd) {
  const result = await run(['symbolic-ref', '--short', 'HEAD'], { cwd });
  return result.ok ? result.stdout : 'unknown';
}

async function getRemotes(cwd) {
  const result = await run(['remote'], { cwd });
  return result.ok ? result.stdout.split('\n').filter(Boolean) : [];
}

async function hasRemote(name, cwd) {
  const result = await run(['remote', 'get-url', name], { cwd });
  return result.ok;
}

async function getRemoteUrl(name, cwd) {
  const result = await run(['remote', 'get-url', name], { cwd });
  return result.ok ? result.stdout : null;
}

async function getWorkingDirectory(cwd) {
  const result = await run(['rev-parse', '--show-toplevel'], { cwd });
  return result.ok ? result.stdout : process.cwd();
}

async function getCommitCount(cwd) {
  const result = await run(['rev-list', '--count', 'HEAD'], { cwd });
  return result.ok ? result.stdout : '0';
}

async function getChangedFileCount(cwd) {
  const result = await run(['status', '--porcelain'], { cwd });
  return result.ok ? result.stdout.split('\n').filter((line) => line.trim()).length : 0;
}

async function getRepoInfo(cwd) {
  const [dir, branch, remotes, commits, changed] = await Promise.all([
    getWorkingDirectory(cwd),
    getCurrentBranch(cwd),
    getRemotes(cwd),
    getCommitCount(cwd),
    getChangedFileCount(cwd),
  ]);

  const remote = remotes.includes('origin') ? 'origin' : remotes[0] || null;
  const remoteUrl = remote ? await getRemoteUrl(remote, cwd) : null;

  return {
    dir,
    branch,
    remote,
    remoteUrl,
    remotes,
    commits,
    changed,
  };
}

// ─── GitHub API helpers ──────────────────────────────────────────────────────

async function githubApiRequest(url, options = {}, authHeaders = {}) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'commit-delete',
    ...authHeaders,
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: response.ok, status: response.status, data };
}

async function createRemoteRepo(token, repoName, { private: isPrivate = true, description = '' } = {}) {
  const response = await githubApiRequest('https://api.github.com/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: repoName,
      private: isPrivate,
      description: description,
      auto_init: false,
    }),
  }, { Authorization: `Bearer ${token}` });

  if (!response.ok) {
    throw new Error(response.data.message || 'Failed to create repository');
  }

  return {
    name: response.data.name,
    fullName: response.data.full_name,
    url: response.data.html_url,
    cloneUrl: response.data.clone_url,
    private: response.data.private,
  };
}

async function checkRemoteRepo(token, owner, repoName) {
  const response = await githubApiRequest(
    `https://api.github.com/repos/${owner}/${repoName}`,
    {},
    { Authorization: `Bearer ${token}` }
  );

  if (!response.ok) {
    return { exists: false, error: response.data.message };
  }

  return {
    exists: true,
    name: response.data.name,
    fullName: response.data.full_name,
    private: response.data.private,
    defaultBranch: response.data.default_branch,
  };
}

async function deleteRemoteRepo(token, owner, repoName) {
  const response = await githubApiRequest(
    `https://api.github.com/repos/${owner}/${repoName}`,
    { method: 'DELETE' },
    { Authorization: `Bearer ${token}` }
  );

  return { ok: response.ok, status: response.status };
}

async function listRemoteRepos(token, { perPage = 30, page = 1 } = {}) {
  const response = await githubApiRequest(
    `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
    {},
    { Authorization: `Bearer ${token}` }
  );

  if (!response.ok) {
    throw new Error(response.data.message || 'Failed to list repositories');
  }

  return response.data.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
  }));
}

async function getGitHubUser(token) {
  const response = await githubApiRequest(
    'https://api.github.com/user',
    {},
    { Authorization: `Bearer ${token}` }
  );

  if (!response.ok) {
    throw new Error(response.data.message || 'Failed to get user info');
  }

  return {
    login: response.data.login,
    name: response.data.name,
    email: response.data.email,
    avatarUrl: response.data.avatar_url,
  };
}

function setupGitCredentials() {
  const account = auth.getActiveAccount();
  if (!account) return null;

  return {
    username: account.username,
    token: account.token,
  };
}

module.exports = {
  run,
  checkGit,
  isInsideWorkTree,
  getCurrentBranch,
  getRemotes,
  hasRemote,
  getRemoteUrl,
  getRepoInfo,
  githubApiRequest,
  createRemoteRepo,
  checkRemoteRepo,
  deleteRemoteRepo,
  listRemoteRepos,
  getGitHubUser,
  setupGitCredentials,
};
