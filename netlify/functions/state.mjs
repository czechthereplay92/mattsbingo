import { getStore } from '@netlify/blobs';

const MIN_PHRASES = 24;
const FREE_LABEL = "FREE\n(Matt's fine)";
const STORE_NAME = 'matt-bingo';
const STATE_KEY = 'state';

const DEFAULT_PHRASES = [
  "Chat, did you see that?",
  "My ping is dogwater",
  "One more game, I swear",
  "Who's on mic just breathing",
  "Let him cook",
  "That's a skill issue",
  "Brb, alt-f4",
  "I'm not toxic, you're toxic",
  "Mute your mic, dude",
  "GG no re",
  "Back in my day...",
  "This lag is unplayable",
  "I called it!",
  "Someone carry me",
  "Wait, we're recording?",
  "That was rigged",
  "I need to touch grass",
  "Who invited this guy",
  "Down bad for a W",
  "It's giving copium",
  "Rage quit incoming",
  "I've got the high ground",
  "Negative, ghost rider",
  "Discord's being weird again"
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard(phrasePool) {
  const picked = shuffle(phrasePool).slice(0, 24);
  const cells = [];
  let p = 0;
  for (let i = 0; i < 25; i++) {
    if (i === 12) {
      cells.push({ label: FREE_LABEL, marked: true, isFree: true, approvedBy: null });
    } else {
      cells.push({ label: picked[p], marked: false, isFree: false, approvedBy: null });
      p++;
    }
  }
  return cells;
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function publicView(state) {
  // Never leak the admin passcode; everything else here is fine to share.
  return { cells: state.cells, claims: state.claims, phrases: state.phrases };
}

async function loadState(store) {
  const existing = await store.get(STATE_KEY, { type: 'json' });
  if (existing) return existing;
  const phrases = [...DEFAULT_PHRASES];
  const fresh = { phrases, cells: buildBoard(phrases), claims: [] };
  await store.setJSON(STATE_KEY, fresh);
  return fresh;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});

  // Netlify's automatic Blobs configuration doesn't always get injected
  // depending on deploy path. Fall back to manual config using
  // NETLIFY_SITE_ID / NETLIFY_API_TOKEN if they're set.
  const storeOptions = { name: STORE_NAME };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN) {
    storeOptions.siteID = process.env.NETLIFY_SITE_ID;
    storeOptions.token = process.env.NETLIFY_API_TOKEN;
  }
  const store = getStore(storeOptions);

  if (event.httpMethod === 'GET') {
    const state = await loadState(store);
    return respond(200, publicView(state));
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return respond(400, { error: 'Bad JSON' });
  }

  const state = await loadState(store);
  const action = body.action;

  if (action === 'claim') {
    const index = body.index;
    if (typeof index !== 'number' || index < 0 || index > 24) {
      return respond(400, { error: 'Bad cell index' });
    }
    const cell = state.cells[index];
    if (!cell || cell.isFree || cell.marked) {
      return respond(400, { error: 'That square is not claimable' });
    }
    if (state.claims.some((c) => c.index === index)) {
      return respond(409, { error: 'Already pending approval' });
    }
    const name = (body.name || 'Anonymous').toString().trim().slice(0, 40) || 'Anonymous';
    state.claims.push({ id: makeId(), index, name, label: cell.label, ts: Date.now() });
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  // Everything below is admin-only.
  const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'changeme';
  if (['approve', 'deny', 'setPhrases', 'newCard', 'clearMarks'].includes(action)) {
    if (body.passcode !== ADMIN_PASSCODE) {
      return respond(401, { error: 'Wrong admin passcode' });
    }
  }

  if (action === 'approve') {
    const claim = state.claims.find((c) => c.id === body.claimId);
    if (!claim) return respond(404, { error: 'Claim not found (someone may have already handled it)' });
    state.cells[claim.index].marked = true;
    state.cells[claim.index].approvedBy = claim.name;
    state.claims = state.claims.filter((c) => c.id !== body.claimId);
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  if (action === 'deny') {
    state.claims = state.claims.filter((c) => c.id !== body.claimId);
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  if (action === 'setPhrases') {
    const list = Array.isArray(body.phrases)
      ? body.phrases.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (list.length < MIN_PHRASES) {
      return respond(400, { error: `Need at least ${MIN_PHRASES} phrases` });
    }
    state.phrases = list;
    state.cells = buildBoard(list);
    state.claims = [];
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  if (action === 'newCard') {
    state.cells = buildBoard(state.phrases);
    state.claims = [];
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  if (action === 'clearMarks') {
    state.cells = buildBoard(state.phrases);
    state.claims = [];
    await store.setJSON(STATE_KEY, state);
    return respond(200, publicView(state));
  }

  return respond(400, { error: 'Unknown action' });
}
