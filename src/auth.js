'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const CONFIG_DIR = path.join(os.homedir(), '.commit-delete');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const ACTIVE_FILE = path.join(CONFIG_DIR, 'active');

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_CLIENT_ID = 'Iv1.0a4b5c6d7e8f9g0h';

// ─── Encryption helpers ──────────────────────────────────────────────────────

function getKey() {
  const keyPath = path.join(CONFIG_DIR, '.key');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function encrypt(text) {
  const key = Buffer.from(getKey(), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data');
  const key = Buffer.from(getKey(), 'hex');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Credentials storage ─────────────────────────────────────────────────────

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadCredentials() {
  ensureConfigDir();
  if (!fs.existsSync(CREDENTIALS_FILE)) return {};
  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    for (const [username, cred] of Object.entries(parsed)) {
      if (cred.token) {
        try {
          cred.token = decrypt(cred.token);
        } catch {
          // Legacy unencrypted token
        }
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveCredentials(credentials) {
  ensureConfigDir();
  const toSave = {};
  for (const [username, cred] of Object.entries(credentials)) {
    toSave[username] = {
      ...cred,
      token: cred.token ? encrypt(cred.token) : null,
    };
  }
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(toSave, null, 2), { mode: 0o600 });
}

function getActiveUsername() {
  if (!fs.existsSync(ACTIVE_FILE)) return null;
  return fs.readFileSync(ACTIVE_FILE, 'utf8').trim() || null;
}

function setActiveUsername(username) {
  ensureConfigDir();
  fs.writeFileSync(ACTIVE_FILE, username, { mode: 0o600 });
}

// ─── GitHub API helpers ──────────────────────────────────────────────────────

async function githubRequest(url, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'commit-delete',
    ...options.headers,
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

async function verifyToken(token) {
  const response = await githubRequest(`${GITHUB_API_URL}/user`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.ok && response.data.login) {
    return { ok: true, username: response.data.login };
  }
  return { ok: false, error: response.data.message || 'Invalid token' };
}

// ─── Device Flow ─────────────────────────────────────────────────────────────

async function startDeviceFlow() {
  const response = await githubRequest(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'repo',
    }),
  });

  if (!response.ok) {
    throw new Error(response.data.message || 'Failed to start device flow');
  }

  return {
    device_code: response.data.device_code,
    user_code: response.data.user_code,
    verification_uri: response.data.verification_uri,
    expires_in: response.data.expires_in,
    interval: response.data.interval || 5,
  };
}

async function pollForToken(deviceCode, interval = 5) {
  const maxAttempts = 180;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    
    const response = await githubRequest(GITHUB_ACCESS_TOKEN_URL, {
      method: 'POST',
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (response.ok && response.data.access_token) {
      return response.data.access_token;
    }

    if (response.data.error === 'authorization_pending') {
      continue;
    }

    if (response.data.error === 'slow_down') {
      interval += 5;
      continue;
    }

    throw new Error(response.data.error_description || response.data.error || 'Device flow failed');
  }

  throw new Error('Device flow timed out');
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function addAccount(username, token) {
  const credentials = loadCredentials();
  
  const verification = await verifyToken(token);
  if (!verification.ok) {
    throw new Error(`Token verification failed: ${verification.error}`);
  }

  const finalUsername = username || verification.username;

  credentials[finalUsername] = {
    token,
    method: 'token',
    addedAt: new Date().toISOString(),
  };

  saveCredentials(credentials);
  
  if (!getActiveUsername()) {
    setActiveUsername(finalUsername);
  }

  return { username: finalUsername, method: 'token' };
}

async function addAccountDeviceFlow() {
  const deviceInfo = await startDeviceFlow();
  
  return {
    device_code: deviceInfo.device_code,
    user_code: deviceInfo.user_code,
    verification_uri: deviceInfo.verification_uri,
    interval: deviceInfo.interval,
    pollForToken: () => pollForToken(deviceInfo.device_code, deviceInfo.interval),
  };
}

async function completeDeviceFlow(deviceCode, interval) {
  const token = await pollForToken(deviceCode, interval);
  const verification = await verifyToken(token);
  
  if (!verification.ok) {
    throw new Error(`Token verification failed: ${verification.error}`);
  }

  const credentials = loadCredentials();
  credentials[verification.username] = {
    token,
    method: 'device',
    addedAt: new Date().toISOString(),
  };

  saveCredentials(credentials);
  
  if (!getActiveUsername()) {
    setActiveUsername(verification.username);
  }

  return { username: verification.username, method: 'device' };
}

function listAccounts() {
  const credentials = loadCredentials();
  const active = getActiveUsername();
  
  return Object.entries(credentials).map(([username, cred]) => ({
    username,
    method: cred.method,
    addedAt: cred.addedAt,
    active: username === active,
  }));
}

function removeAccount(username) {
  const credentials = loadCredentials();
  if (!credentials[username]) {
    throw new Error(`Account "${username}" not found`);
  }

  delete credentials[username];
  saveCredentials(credentials);

  if (getActiveUsername() === username) {
    const remaining = Object.keys(credentials);
    if (remaining.length > 0) {
      setActiveUsername(remaining[0]);
    } else {
      fs.unlinkSync(ACTIVE_FILE);
    }
  }

  return true;
}

function setActiveAccount(username) {
  const credentials = loadCredentials();
  if (!credentials[username]) {
    throw new Error(`Account "${username}" not found`);
  }
  setActiveUsername(username);
  return true;
}

function getActiveAccount() {
  const username = getActiveUsername();
  if (!username) return null;
  
  const credentials = loadCredentials();
  const cred = credentials[username];
  if (!cred) return null;

  return {
    username,
    method: cred.method,
    addedAt: cred.addedAt,
    token: cred.token,
  };
}

function getAuthHeaders() {
  const account = getActiveAccount();
  if (!account) return {};
  return { 'Authorization': `Bearer ${account.token}` };
}

module.exports = {
  addAccount,
  addAccountDeviceFlow,
  completeDeviceFlow,
  listAccounts,
  removeAccount,
  setActiveAccount,
  getActiveAccount,
  getAuthHeaders,
  verifyToken,
  CONFIG_DIR,
  CREDENTIALS_FILE,
};
