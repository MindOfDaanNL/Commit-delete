#!/usr/bin/env node
'use strict';

const cli = require('./cli');
const git = require('./git');
const auth = require('./auth');

const DEFAULT_MESSAGE = 'initial release';
const DEFAULT_REMOTE = 'origin';
const ORPHAN_BRANCH = 'latest_branch';

function parseArgs(argv) {
  const flags = { help: false, yes: false, dryRun: false, branch: null, remote: null, message: null };

  const valueFor = (arg, i) => {
    if (arg.includes('=')) return { value: arg.slice(arg.indexOf('=') + 1), next: i };
    return { value: argv[i + 1], next: i + 1 };
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '-y' || arg === '--yes') {
      flags.yes = true;
    } else if (arg === '-n' || arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '-b' || arg === '--branch' || arg.startsWith('--branch=')) {
      const { value, next } = valueFor(arg, i);
      i = next;
      if (value) flags.branch = value;
    } else if (arg === '-r' || arg === '--remote' || arg.startsWith('--remote=')) {
      const { value, next } = valueFor(arg, i);
      i = next;
      if (value) flags.remote = value;
    } else if (arg === '-m' || arg === '--message' || arg.startsWith('--message=')) {
      const { value, next } = valueFor(arg, i);
      i = next;
      if (value) flags.message = value;
    }
  }

  return flags;
}

function buildSteps({ oldBranch, branch, remote, commitMessage }) {
  const steps = [
    {
      command: `git checkout --orphan ${ORPHAN_BRANCH}`,
      args: ['checkout', '--orphan', ORPHAN_BRANCH],
      label: 'Created orphan branch',
    },
    {
      command: 'git add -A',
      args: ['add', '-A'],
      label: 'Added project files',
    },
    {
      command: `git commit -am "${commitMessage}"`,
      args: ['commit', '-am', commitMessage],
      label: 'Created initial release',
    },
  ];

  if (oldBranch && oldBranch !== 'unknown') {
    steps.push({
      command: `git branch -D ${oldBranch}`,
      args: ['branch', '-D', oldBranch],
      label: `Removed old ${oldBranch} branch`,
    });
  }

  steps.push({
    command: `git branch -M ${branch}`,
    args: ['branch', '-M', branch],
    label: `Renamed branch to ${branch}`,
  });

  steps.push({
    command: `git push -f ${remote} ${branch}`,
    args: ['push', '-f', remote, branch],
    label: `Force-pushed ${remote}/${branch}`,
  });

  return steps;
}

async function chooseBranch(current) {
  const seen = new Set();
  const options = [];
  const add = (name) => {
    if (name && !seen.has(name)) {
      seen.add(name);
      options.push(name === current ? `${name} (current)` : name);
    }
  };

  add(current);
  add('master');
  add('main');
  options.push('✎ Enter custom…');

  const choice = await cli.select('? Target branch:', options, { defaultIndex: 0 });
  if (choice === '✎ Enter custom…') {
    const custom = await cli.textPrompt('Enter branch name', { defaultValue: current });
    return custom || current;
  }
  return choice.replace(/\s*\(current\)$/, '');
}

async function chooseRemote(remotes) {
  if (!remotes.length) {
    const custom = await cli.textPrompt('No remote found — enter remote name', {
      defaultValue: DEFAULT_REMOTE,
    });
    return custom || DEFAULT_REMOTE;
  }

  const preferred = remotes.includes(DEFAULT_REMOTE) ? DEFAULT_REMOTE : remotes[0];
  const seen = new Set();
  const options = [];
  const add = (name) => {
    if (!seen.has(name)) {
      seen.add(name);
      options.push(name);
    }
  };

  add(preferred);
  remotes.forEach(add);
  options.push('✎ Enter custom…');

  const choice = await cli.select('? Target remote:', options, { defaultIndex: 0 });
  if (choice === '✎ Enter custom…') {
    const custom = await cli.textPrompt('Enter remote name', { defaultValue: preferred });
    return custom || preferred;
  }
  return choice;
}

// ─── Auth commands ───────────────────────────────────────────────────────────

async function handleAuthCommand(argv) {
  const command = argv[0];
  const args = argv.slice(1);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    cli.showAuthHelp();
    process.exit(0);
  }

  if (command === 'add') {
    const useToken = args.includes('--token');
    const useDevice = args.includes('--device');

    if (useToken) {
      // Token-based auth
      const tokenIndex = args.indexOf('--token');
      const token = args[tokenIndex + 1] || null;
      
      if (!token) {
        // Interactive: ask for token
        const inputToken = await cli.textPrompt('Enter your GitHub Personal Access Token', {});
        if (!inputToken) {
          cli.showAuthError('No token provided.');
          process.exit(1);
        }
        
        cli.showAuthBanner();
        try {
          const result = await auth.addAccount(null, inputToken);
          cli.showAuthSuccess(result);
        } catch (err) {
          cli.showAuthError(err.message);
          process.exit(1);
        }
      } else {
        // Non-interactive: token provided as argument
        cli.showAuthBanner();
        try {
          const result = await auth.addAccount(null, token);
          cli.showAuthSuccess(result);
        } catch (err) {
          cli.showAuthError(err.message);
          process.exit(1);
        }
      }
    } else if (useDevice) {
      // Device flow
      cli.showAuthBanner();
      try {
        const deviceInfo = await auth.addAccountDeviceFlow();
        cli.showDeviceFlowPrompt(deviceInfo);
        
        const token = await deviceInfo.pollForToken();
        const result = await auth.completeDeviceFlow(deviceInfo.device_code, deviceInfo.interval);
        cli.showAuthSuccess(result);
      } catch (err) {
        cli.showAuthError(err.message);
        process.exit(1);
      }
    } else {
      // Default: ask which method
      const choice = await cli.select(
        '? Choose authentication method:',
        ['Personal Access Token', 'Device Flow (connect device)'],
        { defaultIndex: 0 }
      );

      if (choice === 'Personal Access Token') {
        const inputToken = await cli.textPrompt('Enter your GitHub Personal Access Token', {});
        if (!inputToken) {
          cli.showAuthError('No token provided.');
          process.exit(1);
        }
        
        cli.showAuthBanner();
        try {
          const result = await auth.addAccount(null, inputToken);
          cli.showAuthSuccess(result);
        } catch (err) {
          cli.showAuthError(err.message);
          process.exit(1);
        }
      } else {
        cli.showAuthBanner();
        try {
          const deviceInfo = await auth.addAccountDeviceFlow();
          cli.showDeviceFlowPrompt(deviceInfo);
          
          const token = await deviceInfo.pollForToken();
          const result = await auth.completeDeviceFlow(deviceInfo.device_code, deviceInfo.interval);
          cli.showAuthSuccess(result);
        } catch (err) {
          cli.showAuthError(err.message);
          process.exit(1);
        }
      }
    }
    process.exit(0);
  }

  if (command === 'list') {
    const accounts = auth.listAccounts();
    cli.showAccountList(accounts);
    process.exit(0);
  }

  if (command === 'remove') {
    const username = args[0];
    if (!username) {
      cli.showAuthError('Please specify a username to remove.');
      process.exit(1);
    }

    try {
      auth.removeAccount(username);
      console.log();
      console.log(cli.color(`  Account "${username}" removed.`, 'green'));
      console.log();
    } catch (err) {
      cli.showAuthError(err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  if (command === 'use') {
    const username = args[0];
    if (!username) {
      cli.showAuthError('Please specify a username to set as active.');
      process.exit(1);
    }

    try {
      auth.setActiveAccount(username);
      console.log();
      console.log(cli.color(`  Active account set to "${username}".`, 'green'));
      console.log();
    } catch (err) {
      cli.showAuthError(err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  if (command === 'status') {
    const account = auth.getActiveAccount();
    cli.showAuthBanner();
    
    if (!account) {
      console.log(cli.color('  No active account configured.', 'yellow'));
      console.log();
      console.log(cli.color('  Run "commit-delete auth add" to add an account.', 'dim'));
      console.log();
    } else {
      console.log(cli.color(`  Active account: ${account.username}`, 'cyan'));
      console.log(cli.color(`  Method: ${account.method === 'token' ? 'Personal Access Token' : 'Device Flow'}`, 'dim'));
      console.log(cli.color(`  Added: ${account.addedAt}`, 'dim'));
      console.log();
    }
    process.exit(0);
  }

  cli.showAuthError(`Unknown auth command: ${command}`);
  cli.showAuthHelp();
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  // Check if this is an auth command
  if (argv[0] === 'auth') {
    await handleAuthCommand(argv.slice(1));
    return;
  }

  const flags = parseArgs(argv);

  if (flags.help) {
    cli.showHelp();
    process.exit(0);
  }

  cli.renderBanner();

  const gitAvailable = await git.checkGit();
  if (!gitAvailable) {
    cli.showError('Git could not be found.\n\nPlease install Git and make sure it is available in your PATH.');
    process.exit(1);
  }

  const insideWorkTree = await git.isInsideWorkTree();
  if (!insideWorkTree) {
    cli.showError('This directory is not a Git repository.\n\nNavigate to a Git repository and try again.');
    process.exit(1);
  }

  const info = await git.getRepoInfo();
  cli.showRepoInfo(info);

  const currentBranch = info.branch === 'unknown' ? 'master' : info.branch;
  const interactive = Boolean(process.stdin.isTTY);

  let branch = flags.branch;
  let remote = flags.remote;
  let commitMessage = flags.message;

  if (interactive) {
    branch = branch || (await chooseBranch(currentBranch));
    remote = remote || (await chooseRemote(info.remotes));
    commitMessage =
      commitMessage ||
      (await cli.textPrompt('Commit message', { defaultValue: DEFAULT_MESSAGE }));
  }

  branch = branch || currentBranch;
  remote = remote || (info.remotes.includes(DEFAULT_REMOTE) ? DEFAULT_REMOTE : info.remotes[0]) || DEFAULT_REMOTE;
  commitMessage = commitMessage || DEFAULT_MESSAGE;

  cli.showWarning();
  cli.showConfig({ branch, remote, commit: commitMessage });

  const steps = buildSteps({ oldBranch: info.branch, branch, remote, commitMessage });

  if (flags.dryRun) {
    cli.showDryRun(steps);
    process.exit(0);
  }

  if (!flags.yes) {
    const choice = await cli.confirm(
      '? Are you sure you want to delete the existing Git history?',
      ['No', 'Yes']
    );

    if (choice !== 'Yes') {
      cli.showCancelled();
      process.exit(0);
    }
  }

  for (const step of steps) {
    const result = await git.run(step.args);

    if (!result.ok) {
      if (step.args[0] === 'push') {
        const originExists = await git.hasRemote(remote);
        if (originExists) {
          cli.showPartialFailure(step.command, result.stderr || result.message);
        } else {
          cli.showRemoteMissingAfterRewrite(remote);
        }
      } else {
        cli.showGitError(step.command, result.stderr || result.message);
      }
      process.exit(1);
    }

    cli.showStepDone(step.label);
  }

  cli.showSuccess({ branch, commit: commitMessage, remote });
  process.exit(0);
}

main().catch((error) => {
  cli.showError(`Unexpected error:\n\n${error && error.message ? error.message : error}`);
  process.exit(1);
});
