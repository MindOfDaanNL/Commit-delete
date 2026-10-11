'use strict';

const readline = require('node:readline');
const { color, box, rule } = require('./utils');
const { version } = require('../package.json');

const BANNER = [
  '   ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗',
  '  ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝',
  '  ██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║',
  '  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║',
  '  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║',
  '   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝',
].join('\n');

const WATERMARK = '  Made with ❤️ by MindOfDaanNL';

function renderBanner() {
  console.log(color(BANNER, 'cyan'));
  console.log();
  console.log(
    `  ${color(`COMMIT-DELETE v${version}`, 'bold')}  ${color('· Git history reset utility', 'dim')}`
  );
  console.log();
}

function showRepoInfo(info) {
  console.log(color(rule(' Repository '), 'cyan'));
  console.log();

  const lines = [
    ['Location', info.dir],
    ['Branch', color(info.branch, 'cyan')],
    ['Remote', info.remote ? color(info.remote, 'cyan') : color('none', 'yellow')],
  ];
  if (info.remoteUrl) lines.push(['Remote URL', color(info.remoteUrl, 'dim')]);
  lines.push(['Commits', color(info.commits, 'cyan')]);
  if (info.changed > 0) lines.push(['Changes', color(String(info.changed), 'yellow')]);

  const keyWidth = Math.max(...lines.map(([k]) => k.length));
  for (const [key, value] of lines) {
    console.log(`  ${color(key.padEnd(keyWidth), 'dim')}  :  ${value}`);
  }
  console.log();
}

function showConfig({ branch, remote, commit }) {
  console.log(color(rule(' Configuration '), 'cyan'));
  console.log();

  const lines = [
    ['Target branch', color(branch, 'cyan')],
    ['Remote', color(remote, 'cyan')],
    ['Commit message', color(`"${commit}"`, 'green')],
  ];

  const keyWidth = Math.max(...lines.map(([k]) => k.length));
  for (const [key, value] of lines) {
    console.log(`  ${color(key.padEnd(keyWidth), 'dim')}  :  ${value}`);
  }
  console.log();
}

function showWarning() {
  console.log(
    color(
      box(
        [
          '',
          'WARNING: This operation is destructive!',
          '',
          'The existing Git history will be deleted and replaced',
          'with a completely new initial commit.',
          '',
          'The remote branch will also be force-pushed.',
          '',
        ],
        { title: 'COMMIT-DELETE' }
      ),
      'yellow'
    )
  );
  console.log();
}

function showRemoteMissingAfterRewrite(remote) {
  console.log();
  console.log(color(rule(' Remote missing '), 'red'));
  console.log();
  console.log(`  Remote "${remote}" was not found.`);
  console.log();
  console.log('  The Git history has been rewritten locally, but the remote');
  console.log('  could not be updated.');
  console.log();
  console.log('  Please add the remote and manually push when ready.');
  console.log();
}

function select(question, choices, { defaultIndex = 0 } = {}) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const finish = (value) => {
        rl.removeListener('close', onClose);
        rl.close();
        resolve(value);
      };
      const onClose = () => finish(choices[defaultIndex]);
      rl.once('close', onClose);
      rl.question(`${color(question, 'bold')} [${choices.join('/')}] `, (answer) => {
        const match = choices.find(
          (choice) => choice.toLowerCase() === (answer || '').trim().toLowerCase()
        );
        finish(match || choices[defaultIndex]);
      });
      return;
    }

    let selected = defaultIndex;
    let rendered = false;

    const draw = () => {
      const lines = [
        color(question, 'bold'),
        ...choices.map((choice, i) =>
          i === selected ? color(`❯ ${choice}`, 'cyan') : `  ${choice}`
        ),
      ];
      if (rendered) {
        readline.moveCursor(stdout, 0, -(lines.length - 1));
        readline.clearScreenDown(stdout);
      }
      stdout.write(lines.join('\n'));
      rendered = true;
    };

    const finish = (value) => {
      stdin.removeListener('keypress', onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolve(value);
    };

    const onKeypress = (str, key) => {
      if (!key) return;
      if (key.name === 'up') {
        selected = (selected - 1 + choices.length) % choices.length;
        draw();
      } else if (key.name === 'down') {
        selected = (selected + 1) % choices.length;
        draw();
      } else if (key.name === 'return') {
        finish(choices[selected]);
      } else if (key.name === 'c' && key.ctrl) {
        finish(null);
      }
    };

    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', onKeypress);
    draw();
  });
}

function textPrompt(question, { defaultValue } = {}) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const rl = readline.createInterface({ input: stdin, output: process.stdout });
    const suffix = defaultValue ? color(` [${defaultValue}]`, 'dim') : '';
    const prompt = `${color('❯ ', 'cyan')}${color(question, 'bold')}${suffix}: `;

    const finish = (value) => {
      rl.removeListener('close', onClose);
      rl.close();
      resolve(value);
    };
    const onClose = () => finish(defaultValue || '');

    rl.once('close', onClose);
    rl.question(prompt, (answer) => {
      const value = (answer || '').trim();
      finish(value || defaultValue || '');
    });
  });
}

async function confirm(question, choices, { defaultIndex = 0 } = {}) {
  return select(question, choices, { defaultIndex });
}

function showStepDone(label) {
  console.log(color(`  ✔ ${label}`, 'green'));
}

function showError(message) {
  console.log();
  console.log(color(rule(' Error '), 'red'));
  console.log();
  console.log(color(`  ${message}`, 'red'));
  console.log();
}

function showCancelled() {
  console.log();
  console.log(color(rule(' Cancelled '), 'yellow'));
  console.log();
  console.log('  Operation cancelled.');
  console.log('  No changes were made.');
  console.log();
}

function showGitError(command, stderr) {
  console.log();
  console.log(color(rule(' Git command failed '), 'red'));
  console.log();
  console.log(`  ${color('$', 'green')} ${command}`);
  console.log();
  if (stderr) console.log(color(stderr, 'red'));
  console.log();
  console.log(color('  Commit-delete stopped.', 'red'));
  console.log();
}

function showPartialFailure(command, stderr) {
  console.log();
  console.log(color(rule(' Warning '), 'yellow'));
  console.log();
  console.log('  The local Git history was rewritten successfully, but the');
  console.log('  remote push failed.');
  console.log();
  console.log('  Your local repository is now using the new history.');
  console.log();
  console.log('  Please resolve the remote issue and manually push when ready.');
  console.log();
  console.log('  Failed command:');
  console.log(`    ${color('$', 'green')} ${command}`);
  if (stderr) console.log(color(stderr, 'red'));
  console.log();
}

function showDryRun(steps) {
  console.log(color(rule(' Dry run '), 'cyan'));
  console.log();
  console.log(color('  The following commands would be executed:', 'bold'));
  console.log();
  for (const step of steps) {
    console.log(`    ${color('$', 'green')} ${step.command}`);
  }
  console.log();
  console.log(color('  No changes were made.', 'dim'));
  console.log();
}

function showSuccess({ branch, commit, remote }) {
  console.log(
    color(
      box(
        [
          '',
          '  Git history successfully reset.',
          '',
          `  Branch         : ${branch}`,
          `  Commit message : "${commit}"`,
          `  Remote         : ${remote}`,
          '',
          '  The new history has been force-pushed successfully.',
          '',
        ],
        { title: 'SUCCESS' }
      ),
      'green'
    )
  );
  console.log();
}

function showHelp() {
  console.log(color(rule(' Commit-delete '), 'cyan'));
  console.log();
  console.log(
    `  ${color('COMMIT-DELETE', 'bold')} ${color(`v${version}`, 'dim')} — Git history reset utility`
  );
  console.log();
  console.log(color('  Usage:', 'bold'));
  console.log(`    ${color('commit-delete', 'bold')} [options]`);
  console.log(`    ${color('commit-delete', 'bold')} auth <command> [options]`);
  console.log();
  console.log(color('  Options:', 'bold'));
  const opts = [
    ['-b, --branch <name>', 'Target branch (default: current branch)'],
    ['-r, --remote <name>', 'Remote to push to (default: origin)'],
    ['-m, --message <text>', 'Commit message (default: "initial release")'],
    ['-y, --yes', 'Skip the confirmation prompt'],
    ['-n, --dry-run', 'Show commands without executing them'],
    ['-h, --help', 'Show this help'],
  ];
  const width = Math.max(...opts.map(([key]) => key.length));
  for (const [key, value] of opts) {
    console.log(`    ${color(key.padEnd(width), 'cyan')}  ${color(value, 'dim')}`);
  }
  console.log();
  console.log(color('  Auth commands:', 'bold'));
  console.log(`    ${color('commit-delete auth add', 'cyan')}  Add a GitHub account`);
  console.log(`    ${color('commit-delete auth list', 'cyan')}  List configured accounts`);
  console.log(`    ${color('commit-delete auth remove <user>', 'cyan')}  Remove an account`);
  console.log(`    ${color('commit-delete auth use <user>', 'cyan')}  Set active account`);
  console.log(`    ${color('commit-delete auth status', 'cyan')}  Show auth status`);
  console.log();
}

function showAuthBanner() {
  console.log(color(rule(' Authentication '), 'cyan'));
  console.log();
}

function showAuthSuccess({ username, method }) {
  console.log(
    color(
      box(
        [
          '',
          '  Account successfully added.',
          '',
          `  Username : ${username}`,
          `  Method   : ${method === 'token' ? 'Personal Access Token' : 'Device Flow'}`,
          '',
        ],
        { title: 'SUCCESS' }
      ),
      'green'
    )
  );
  console.log();
}

function showAuthError(message) {
  console.log();
  console.log(color(rule(' Authentication Error '), 'red'));
  console.log();
  console.log(color(`  ${message}`, 'red'));
  console.log();
}

function showDeviceFlowPrompt({ userCode, verificationUri, interval }) {
  console.log(
    color(
      box(
        [
          '',
          '  GitHub Device Authorization',
          '',
          `  1. Go to: ${color(verificationUri, 'cyan')}`,
          `  2. Enter code: ${color(userCode, 'bold')}`,
          '',
          `  Waiting for authorization... (every ${interval}s)`,
          '  Press Ctrl+C to cancel',
          '',
        ],
        { title: 'DEVICE FLOW' }
      ),
      'yellow'
    )
  );
  console.log();
}

function showAccountList(accounts) {
  console.log(color(rule(' Accounts '), 'cyan'));
  console.log();

  if (accounts.length === 0) {
    console.log(color('  No accounts configured.', 'dim'));
    console.log();
    return;
  }

  const keyWidth = Math.max(...accounts.map((a) => a.username.length), 8);
  for (const account of accounts) {
    const marker = account.active ? color('●', 'green') : color('○', 'dim');
    const method = account.method === 'token' ? 'token' : 'device';
    console.log(`  ${marker} ${color(account.username.padEnd(keyWidth), 'cyan')}  ${color(method, 'dim')}`);
  }
  console.log();
}

function showAuthHelp() {
  console.log(color(rule(' Authentication '), 'cyan'));
  console.log();
  console.log(color('  Usage:', 'bold'));
  console.log(`    ${color('commit-delete auth', 'bold')} <command> [options]`);
  console.log();
  console.log(color('  Commands:', 'bold'));
  const cmds = [
    ['add', 'Add a GitHub account'],
    ['add --token', 'Add account with Personal Access Token'],
    ['add --device', 'Add account with Device Flow'],
    ['list', 'List all configured accounts'],
    ['remove <username>', 'Remove an account'],
    ['use <username>', 'Set active account'],
    ['status', 'Show current authentication status'],
  ];
  const width = Math.max(...cmds.map(([key]) => key.length));
  for (const [key, value] of cmds) {
    console.log(`    ${color(key.padEnd(width), 'cyan')}  ${color(value, 'dim')}`);
  }
  console.log();
}

module.exports = {
  renderBanner,
  showRepoInfo,
  showConfig,
  showWarning,
  showRemoteMissingAfterRewrite,
  select,
  textPrompt,
  confirm,
  showStepDone,
  showError,
  showCancelled,
  showGitError,
  showPartialFailure,
  showDryRun,
  showSuccess,
  showHelp,
  showAuthBanner,
  showAuthSuccess,
  showAuthError,
  showDeviceFlowPrompt,
  showAccountList,
  showAuthHelp,
  color,
};