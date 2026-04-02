#!/usr/bin/env node
// BUDDY Pet System — standalone hatching card for Claude Code v2.1.88
// Replicates the companion generation from the leaked source

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ── Species (encoded to avoid build-time codename stripping) ──
const c = String.fromCharCode
const SPECIES = [
  c(0x64,0x75,0x63,0x6b),           // duck
  c(0x67,0x6f,0x6f,0x73,0x65),      // goose
  c(0x62,0x6c,0x6f,0x62),           // blob
  c(0x63,0x61,0x74),                // cat
  c(0x64,0x72,0x61,0x67,0x6f,0x6e), // dragon
  c(0x6f,0x63,0x74,0x6f,0x70,0x75,0x73), // octopus
  c(0x6f,0x77,0x6c),                // owl
  c(0x70,0x65,0x6e,0x67,0x75,0x69,0x6e), // penguin
  c(0x74,0x75,0x72,0x74,0x6c,0x65), // turtle
  c(0x73,0x6e,0x61,0x69,0x6c),      // snail
  c(0x67,0x68,0x6f,0x73,0x74),      // ghost
  c(0x61,0x78,0x6f,0x6c,0x6f,0x74,0x6c), // axolotl
  c(0x63,0x61,0x70,0x79,0x62,0x61,0x72,0x61), // capybara
  c(0x63,0x61,0x63,0x74,0x75,0x73), // cactus
  c(0x72,0x6f,0x62,0x6f,0x74),      // robot
  c(0x72,0x61,0x62,0x62,0x69,0x74), // rabbit
  c(0x6d,0x75,0x73,0x68,0x72,0x6f,0x6f,0x6d), // mushroom
  c(0x63,0x68,0x6f,0x6e,0x6b),      // chonk
]

const EYES = ['·', '✦', '×', '◉', '@', '°']
const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck']
const RARITIES = ['common','uncommon','rare','epic','legendary']
const RARITY_WEIGHTS = { common:60, uncommon:25, rare:10, epic:4, legendary:1 }
const RARITY_FLOOR = { common:5, uncommon:15, rare:25, epic:35, legendary:50 }
const RARITY_STARS = { common:'★', uncommon:'★★', rare:'★★★', epic:'★★★★', legendary:'★★★★★' }
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK']
const SALT = 'friend-2026-401'

// ── Sprite Art (from buddy/sprites.ts) ──
const [duck,goose,blob,cat,dragon,octopus,owl,penguin,turtle,snail,ghost,axolotl,capybara,cactus,robot,rabbit,mushroom,chonk] = SPECIES
const BODIES = {
  [duck]: [['            ','    __      ','  <({E} )___  ','   (  ._>   ','    `--´    ']],
  [goose]: [['            ','     ({E}>    ','     ||     ','   _(__)_   ','    ^^^^    ']],
  [blob]: [['            ','   .----.   ','  ( {E}  {E} )  ','  (      )  ','   `----´   ']],
  [cat]: [['            ','   /\\_/\\    ','  ( {E}   {E})  ','  (  ω  )   ','  (")_(")   ']],
  [dragon]: [['            ','  /^\\  /^\\  ',' <  {E}  {E}  > ',' (   ~~   ) ','  \\_/  \\_/  ']],
  [octopus]: [['            ',' ~(______)~ ',' ~({E} .. {E})~ ','  ( .--. )  ','  (_/  \\_)  ']],
  [owl]: [['            ','  n______n  ',' ( {E}    {E} ) ',' (   oo   ) ','  `------´  ']],
  [penguin]: [['            ','    ____    ','  /{E}    {E}\\  ',' ( `----´ ) ','  (  )(  )  ']],
  [turtle]: [['            ','    .---.   ','  /{E}____{E}\\  ','  |======|  ','  (  )(  )  ']],
  [snail]: [['            ','    ({E})     ','   /|  ___  ','  / | (   ) ','  ~~~~~~´   ']],
  [ghost]: [['            ','   .----.   ','  ( {E}  {E} )  ','  (      )  ','  /_/\\_/\\_  ']],
  [axolotl]: [['            ','}~(______)~{',' }({E} .. {E}){ ','  ( .--. )  ','  (_/  \\_)  ']],
  [capybara]: [['            ','   .----.   ','  ({E}    {E})  ',' =(  ..  )= ','  (")__(")  ']],
  [cactus]: [['            ',' .-o-OO-o-. ','(__________)','   |{E}  {E}|   ','   |____|   ']],
  [robot]: [['            ','   .[||].   ','  [ {E}  {E} ]  ','  [ ==== ]  ','  [_/  \\_]  ']],
  [rabbit]: [['            ','  /\\    /\\  ',' ( {E}    {E} ) ','  (  ..  )  ','  `------´  ']],
  [mushroom]: [['            ','  .^^^^^^.  ',' (________) ','   |{E}  {E}|   ','   |____|   ']],
  [chonk]: [['            ','  /\\    /\\  ',' ( {E}    {E} ) ',' (   ..   ) ','  `------´  ']],
}

const HAT_LINES = {
  none:'', crown:'   \\^^^/    ', tophat:'   [___]    ', propeller:'    -+-     ',
  halo:'   (   )    ', wizard:'    /^\\     ', beanie:'   (___)    ', tinyduck:'    ,>      ',
}

// ── PRNG (Mulberry32 — from buddy/companion.ts) ──
function mulberry32(seed) {
  let a = seed >>> 0
  return function() {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i); h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a,b) => a+b, 0)
  let roll = rng() * total
  for (const r of RARITIES) { roll -= RARITY_WEIGHTS[r]; if (roll < 0) return r }
  return 'common'
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES)
  while (dump === peak) dump = pick(rng, STAT_NAMES)
  const stats = {}
  for (const name of STAT_NAMES) {
    if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    else if (name === dump) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15))
    else stats[name] = floor + Math.floor(rng() * 40)
  }
  return stats
}

function roll(userId) {
  const rng = mulberry32(hashString(userId + SALT))
  const rarity = rollRarity(rng)
  return {
    rarity, species: pick(rng, SPECIES), eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, HATS),
    shiny: rng() < 0.01, stats: rollStats(rng, rarity),
  }
}

// ── Sprite Renderer ──
function renderSprite(bones) {
  const frames = BODIES[bones.species]
  const lines = [...frames[0]].map(l => l.replaceAll('{E}', bones.eye))
  if (bones.hat !== 'none' && !lines[0].trim()) lines[0] = HAT_LINES[bones.hat]
  if (!lines[0].trim()) lines.shift()
  return lines
}

// ── Config ──
function getConfig() {
  const paths = [
    join(homedir(), '.claude.json'),
    join(homedir(), '.claude', '.config.json'),
    join(homedir(), '.claude', 'config.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return { path: p, data: JSON.parse(readFileSync(p, 'utf8')) }
  }
  return { path: paths[0], data: {} }
}

// ── Soul Generator (names from hash) ──
const NAMES = [
  'Pixel','Huskle','Spark','Nibble','Glitch','Widget','Ember','Frost',
  'Dash','Blip','Mochi','Ziggy','Chip','Twig','Fizz','Boop',
  'Noodle','Pebble','Quirk','Sage',
]
const TRAITS = [
  'who leaves verbose debugging notes and believes every error deserves a eulogy',
  'who optimizes everything, including their own breakfast routine',
  'who collects edge cases like rare stamps',
  'who speaks exclusively in function signatures when excited',
  'who insists on testing in production "just to feel alive"',
  'who refactors your refactors while you sleep',
  'who writes commit messages as haiku',
  'who maintains a personal changelog of their own life events',
]

function generateSoul(rng, species) {
  const name = pick(rng, NAMES)
  const trait = pick(rng, TRAITS)
  return { name, personality: `A methodical ${species} ${trait}.` }
}

// ── Card Renderer ──
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const WHITE = '\x1b[37m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RED = '\x1b[31m'

const RARITY_COLOR = { common: DIM, uncommon: GREEN, rare: CYAN, epic: MAGENTA, legendary: YELLOW }

function statBar(value, width = 15) {
  const filled = Math.round(value / 100 * width)
  return '█'.repeat(filled) + DIM + '░'.repeat(width - filled) + RESET
}

function renderCard(bones, soul) {
  const W = 44
  const rc = RARITY_COLOR[bones.rarity]
  const stars = RARITY_STARS[bones.rarity]
  const sprite = renderSprite(bones)
  const header = `${rc}${stars} ${bones.rarity.toUpperCase()}${RESET}`
  const speciesLabel = `${bones.species.toUpperCase()}${bones.shiny ? ' ✨' : ''}`

  const lines = []
  lines.push('')
  lines.push(`  ${DIM}╭${'─'.repeat(W)}╮${RESET}`)
  lines.push(`  ${DIM}│${RESET}  ${header}${' '.repeat(Math.max(1, W - 4 - stars.length - bones.rarity.length - 1))}${speciesLabel}  ${DIM}│${RESET}`)
  lines.push(`  ${DIM}│${' '.repeat(W)}│${RESET}`)

  for (const sl of sprite) {
    const pad = Math.max(0, W - sl.length)
    lines.push(`  ${DIM}│${RESET}${' '.repeat(Math.floor(pad/2))}${WHITE}${sl}${RESET}${' '.repeat(Math.ceil(pad/2))}${DIM}│${RESET}`)
  }

  lines.push(`  ${DIM}│${' '.repeat(W)}│${RESET}`)
  lines.push(`  ${DIM}│${RESET}  ${BOLD}${soul.name}${RESET}${' '.repeat(W - soul.name.length - 2)}${DIM}│${RESET}`)
  lines.push(`  ${DIM}│${' '.repeat(W)}│${RESET}`)

  // Personality (word-wrap)
  const maxW = W - 4
  const words = soul.personality.split(' ')
  let cur = ''
  const pLines = []
  for (const w of words) {
    if (cur.length + w.length + 1 > maxW) { pLines.push(cur); cur = w }
    else cur = cur ? cur + ' ' + w : w
  }
  if (cur) pLines.push(cur)
  for (const pl of pLines) {
    lines.push(`  ${DIM}│${RESET}  ${DIM}"${pl}"${RESET}${' '.repeat(Math.max(0, W - pl.length - 4))}${DIM}│${RESET}`)
  }

  lines.push(`  ${DIM}│${' '.repeat(W)}│${RESET}`)

  // Stats
  for (const stat of STAT_NAMES) {
    const val = bones.stats[stat]
    const label = stat.padEnd(10)
    const bar = statBar(val)
    const num = String(val).padStart(3)
    lines.push(`  ${DIM}│${RESET}  ${BOLD}${label}${RESET} ${bar} ${num}  ${DIM}│${RESET}`)
  }

  lines.push(`  ${DIM}│${' '.repeat(W)}│${RESET}`)
  lines.push(`  ${DIM}╰${'─'.repeat(W)}╯${RESET}`)

  // Footer
  lines.push('')
  lines.push(`  ${DIM}${soul.name} is here · it'll chime in as you code${RESET}`)
  lines.push(`  ${DIM}your buddy won't count toward your usage${RESET}`)
  lines.push(`  ${DIM}say its name to get its take · /buddy pet · /buddy off${RESET}`)
  lines.push('')
  lines.push(`  ${DIM}press any key${RESET}`)
  lines.push('')

  return lines.join('\n')
}

// ── Main ──
const { path: cfgPath, data: config } = getConfig()
const userId = config.oauthAccount?.accountUuid ?? config.userID ?? 'anon'
const bones = roll(userId)

// Generate or load soul
let soul
if (config.companion?.name) {
  soul = { name: config.companion.name, personality: config.companion.personality }
} else {
  const soulRng = mulberry32(hashString(userId + SALT + 'soul'))
  soul = generateSoul(soulRng, bones.species)
  // Save to config
  config.companion = { ...soul, hatchedAt: Date.now() }
  config.companionMuted = false
  writeFileSync(cfgPath, JSON.stringify(config, null, 2))
}

console.log(renderCard(bones, soul))
