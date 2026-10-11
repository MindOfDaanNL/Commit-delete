'use strict';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function color(text, name) {
  if (!process.stdout.isTTY || !COLORS[name]) return text;
  return `${COLORS[name]}${text}${COLORS.reset}`;
}

function box(lines, { title, width } = {}) {
  const content = Array.isArray(lines) ? lines : [lines];
  const innerWidth = Math.max(
    width || 0,
    ...content.map((line) => line.length),
    title ? title.length : 0
  );
  const border = '═'.repeat(innerWidth + 2);
  const out = [];

  out.push(`╔${border}╗`);
  if (title) {
    out.push(`║ ${title.padEnd(innerWidth)} ║`);
    out.push(`╠${border}╣`);
  }
  for (const line of content) {
    out.push(`║ ${line.padEnd(innerWidth)} ║`);
  }
  out.push(`╚${border}╝`);

  return out.join('\n');
}

function rule(text = '', width = 48) {
  const w = Math.max(12, width);
  if (!text) return '─'.repeat(w);
  const inner = ` ${text} `;
  const side = Math.max(0, Math.floor((w - inner.length) / 2));
  const left = '─'.repeat(side);
  const right = '─'.repeat(Math.max(0, w - inner.length - side));
  return `${left}${inner}${right}`;
}

module.exports = { color, box, rule };