"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WeaponClass = "shotgun" | "dagger" | "machinegun";
type PartType = "shots" | "damage" | "range" | "lifesteal" | "spin" | "magnet" | "income" | "shotSpread" | "shotCount" | "pierce" | "knockback" | "attackSpeed" | "daggerArc" | "daggerHits" | "bleed" | "targetCount";
type DropType = "coin" | "part" | "core" | "ticket" | "heal";
type EnemyKind = "normal" | "charger" | "shooter" | "splitter" | "shard";
type BossKind = "normal" | "storm" | "summoner";
type ModalType = "upgrade" | "promotion" | "gameover" | null;

type Weapon = {
  level: number;
  damage: number;
  range: number;
  shots: number;
  promotion: WeaponClass | null;
  attackSpeed: number;
  pierce: number;
  knockback: number;
  daggerArc: number;
  daggerHits: number;
  bleed: number;
  targetCount: number;
  installed: Record<PartType, number>;
};

type Player = { x: number; y: number; radius: number; hp: number; maxHp: number; hit: number };
type Enemy = { id: number; x: number; y: number; radius: number; hp: number; maxHp: number; attack: number; speed: number; hue: number; hit: number; bleedDamage: number; bleedTimer: number; boss?: boolean; bossKind?: BossKind; kind?: EnemyKind; fast?: boolean; shootTimer: number; abilityTimer: number; chargeTimer: number };
type Bullet = { x: number; y: number; vx: number; vy: number; damage: number; life: number; pierce: number; hitIds: number[] };
type EnemyBullet = { x: number; y: number; vx: number; vy: number; damage: number; life: number };
type Drop = { id: number; x: number; y: number; type: DropType; part?: PartType; ticketLevel?: number; life: number };

type GameState = {
  player: Player;
  weapon: Weapon;
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  drops: Drop[];
  coins: number;
  cores: number;
  parts: Record<PartType, number>;
  kills: number;
  elapsed: number;
  fireTimer: number;
  spawnTimer: number;
  spawnWave: number;
  spawnedThisWave: number;
  spawnEdge: number;
  spinTimer: number;
  spinAngle: number;
  highestWeaponLevel: number;
  lastBossWave: number;
  upgradeTickets: Record<number, number>;
  nextId: number;
};

const WIDTH = 960;
const HEIGHT = 600;
const WAVE_SECONDS = 20;
const TICKET_LEVELS = [1, 2, 3, 5, 10];
const PART_TYPES: PartType[] = ["shots", "damage", "range", "lifesteal", "spin", "magnet", "income", "shotSpread", "shotCount", "pierce", "knockback", "attackSpeed", "daggerArc", "daggerHits", "bleed", "targetCount"];
const PRE_PROMOTION_PARTS: PartType[] = ["shots", "damage", "magnet", "income", "spin"];
const CLASS_PARTS: Record<WeaponClass, PartType[]> = { shotgun: ["shotSpread", "shotCount", "pierce", "knockback", "attackSpeed"], dagger: ["daggerArc", "daggerHits", "bleed", "attackSpeed"], machinegun: ["attackSpeed", "targetCount"] };
const getAvailablePartTypes = (promotion: WeaponClass | null) => promotion ? ["damage", "magnet", "income", ...CLASS_PARTS[promotion]] : PRE_PROMOTION_PARTS;
const PART_LABELS: Record<PartType, string> = { shots: "타수 증가", damage: "데미지 증가", range: "범위 증가", lifesteal: "흡혈", spin: "주변 피해", magnet: "자석", income: "돈 수급량 증가", shotSpread: "갈래 증가", shotCount: "타수 증가", pierce: "관통력", knockback: "넉백", attackSpeed: "공속 증가", daggerArc: "베기 각도", daggerHits: "베기 타수", bleed: "출혈 피해", targetCount: "공격 목표 추가" };
const PART_ICONS: Record<PartType, string> = { shots: "✣", damage: "✹", range: "◉", lifesteal: "♥", spin: "⟲", magnet: "⌁", income: "₩", shotSpread: "✣", shotCount: "✣", pierce: "➤", knockback: "↯", attackSpeed: "⌁", daggerArc: "◒", daggerHits: "╳", bleed: "♦", targetCount: "◎" };

const makeGame = (): GameState => ({
  player: { x: WIDTH / 2, y: HEIGHT / 2, radius: 17, hp: 100, maxHp: 100, hit: 0 },
  weapon: { level: 0, damage: 22, range: 230, shots: 1, promotion: null, attackSpeed: 0, pierce: 0, knockback: 0, daggerArc: 60, daggerHits: 1, bleed: 0, targetCount: 1, installed: { shots: 0, damage: 0, range: 0, lifesteal: 0, spin: 0, magnet: 0, income: 0, shotSpread: 0, shotCount: 0, pierce: 0, knockback: 0, attackSpeed: 0, daggerArc: 0, daggerHits: 0, bleed: 0, targetCount: 0 } },
  enemies: [], bullets: [], enemyBullets: [], drops: [], coins: 0, cores: 0,
  parts: { shots: 0, damage: 0, range: 0, lifesteal: 0, spin: 0, magnet: 0, income: 0, shotSpread: 0, shotCount: 0, pierce: 0, knockback: 0, attackSpeed: 0, daggerArc: 0, daggerHits: 0, bleed: 0, targetCount: 0 }, kills: 0, elapsed: 0, fireTimer: 0, spawnTimer: 0.9, spawnWave: 1, spawnedThisWave: 0, spawnEdge: 0, spinTimer: 1.4, spinAngle: 0, nextId: 1,
  highestWeaponLevel: 0, lastBossWave: 0, upgradeTickets: { 1: 0, 2: 0, 3: 0, 5: 0, 10: 0 },
});

const partChance = (weapon: Weapon, part: PartType) => Math.max(30, 90 - weapon.installed[part] * 8);
const weaponChance = (weapon: Weapon) => Math.max(0, 99 - weapon.level);
const upgradeCost = (level: number) => 8 + level * 5;
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")} : ${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function VampirePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: WIDTH / 2, y: HEIGHT / 2 });
  const gameRef = useRef<GameState>(makeGame());
  const keysRef = useRef<Record<string, boolean>>({});
  const runningRef = useRef(true);
  const pausedRef = useRef(false);
  const modalRef = useRef<ModalType>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [snapshot, setSnapshot] = useState(() => makeGame());
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedParts, setSelectedParts] = useState<PartType[]>([]);
  const [selectAllPartsMode, setSelectAllPartsMode] = useState(false);
  const [autoUseCores, setAutoUseCores] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [attemptBoost, setAttemptBoost] = useState(0);
  const [result, setResult] = useState<string[]>([]);
  const [message, setMessage] = useState("어둠이 깨어났습니다. 살아남으세요.");

  const ensureAudio = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.state === "suspended") void audioRef.current.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioRef.current = new AudioContextClass();
  }, []);

  const playTone = useCallback((frequency: number, duration: number, waveform: OscillatorType = "sine", volume = 0.025, slide = 1) => {
    const context = audioRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);

  const setGameModal = useCallback((next: ModalType) => {
    modalRef.current = next;
    pausedRef.current = Boolean(next);
    setModal(next);
  }, []);

  const publishSnapshot = useCallback(() => {
    const game = gameRef.current;
    setSnapshot({ ...game, player: { ...game.player }, weapon: { ...game.weapon, installed: { ...game.weapon.installed } }, parts: { ...game.parts } });
  }, []);

  const spawnEnemy = (game: GameState, preferredEdge?: number) => {
    const edge = preferredEdge ?? Math.floor(Math.random() * 4);
    const x = edge === 0 ? -30 : edge === 1 ? WIDTH + 30 : Math.random() * WIDTH;
    const y = edge === 2 ? -30 : edge === 3 ? HEIGHT + 30 : Math.random() * HEIGHT;
    const monsterLevel = game.highestWeaponLevel;
    const wave = Math.floor(game.elapsed / WAVE_SECONDS) + 1;
    const wavePressure = wave <= 3 ? [0.08, 0.16, 0.28][wave - 1] : 1 + (wave - 3) * 0.38;
    const difficulty = (Math.min(2.2, game.elapsed / 120) + monsterLevel * 0.12) * wavePressure;
    const fast = wave >= 5 && Math.random() < Math.min(0.32, 0.2 + (wave - 5) * 0.015);
    const variantRoll = Math.random();
    const kind: EnemyKind = wave >= 8 && variantRoll < 0.12 ? "shooter" : wave >= 10 && variantRoll < 0.24 ? "splitter" : wave >= 6 && variantRoll < 0.34 ? "charger" : "normal";
    const hpScale = kind === "splitter" ? 1.35 : kind === "shooter" ? 0.85 : kind === "charger" ? 1.1 : 1;
    const attackScale = kind === "shooter" ? 0.75 : kind === "charger" ? 1.2 : 1;
    const speedScale = kind === "charger" ? 1.25 : kind === "shooter" ? 0.72 : 1;
    const baseHp = wave <= 3 ? 9 + difficulty * 14 + monsterLevel * 8 + Math.random() * 6 : 22 + difficulty * 34 + monsterLevel * 18 + Math.random() * 12;
    const hp = baseHp * hpScale;
    const attack = Math.min(50, (5 + monsterLevel * 3.8 + (wave <= 3 ? 0 : difficulty * 6.2)) * attackScale);
    const baseSpeed = (wave <= 3 ? 24 + Math.random() * 12 + difficulty * 4.5 : 14 + Math.random() * 8 + difficulty * 3.5) * speedScale;
    game.enemies.push({ id: game.nextId++, x, y, radius: kind === "shooter" ? 14 : fast ? 10 : 12 + Math.random() * 7, hp, maxHp: hp, attack, speed: fast ? baseSpeed * 2 : baseSpeed, hue: kind === "shooter" ? 205 : kind === "splitter" ? 52 : kind === "charger" ? 12 : fast ? 26 : 340 + Math.random() * 30, hit: 0, bleedDamage: 0, bleedTimer: 0, kind, fast, shootTimer: kind === "shooter" ? 1.2 : 0, abilityTimer: kind === "charger" ? 2.4 : 0, chargeTimer: 0 });
  };

  const spawnBoss = (game: GameState) => {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? -60 : edge === 1 ? WIDTH + 60 : Math.random() * WIDTH;
    const y = edge === 2 ? -60 : edge === 3 ? HEIGHT + 60 : Math.random() * HEIGHT;
    const monsterLevel = game.highestWeaponLevel;
    const hp = 2400 + monsterLevel * 400 + Math.floor(game.elapsed / WAVE_SECONDS) * 520;
    const bossWave = Math.floor(game.elapsed / WAVE_SECONDS) + 1;
    const attack = Math.min(50, 4 + Math.min(10, Math.max(0, bossWave - 5) * 0.5) + monsterLevel * 5.2);
    const bossKind: BossKind = bossWave >= 15 ? (bossWave % 10 === 5 ? "summoner" : "storm") : bossWave >= 10 ? "storm" : "normal";
    game.enemies.push({ id: game.nextId++, x, y, radius: 34, hp, maxHp: hp, attack, speed: 21 + monsterLevel * 1.8, hue: bossKind === "storm" ? 204 : bossKind === "summoner" ? 112 : 286, hit: 0, bleedDamage: 0, bleedTimer: 0, boss: true, bossKind, shootTimer: 1.0, abilityTimer: bossKind === "summoner" ? 2.8 : 3.8, chargeTimer: 0 });
  };

  const createDrop = (game: GameState, enemy: Enemy) => {
    const roll = Math.random();
    const partPool = getAvailablePartTypes(game.weapon.promotion);
    if (roll < 0.85) game.drops.push({ id: game.nextId++, x: enemy.x, y: enemy.y, type: "coin", life: 18 });
    else if (roll < 0.98) game.drops.push({ id: game.nextId++, x: enemy.x, y: enemy.y, type: "part", part: partPool[Math.floor(Math.random() * partPool.length)], life: 18 });
    else game.drops.push({ id: game.nextId++, x: enemy.x, y: enemy.y, type: "core", life: 18 });
  };

  const createBossDrop = (game: GameState, enemy: Enemy) => {
    const roll = Math.random();
    const ticketLevel = roll < 0.5 ? 1 : roll < 0.8 ? 2 : roll < 0.95 ? 3 : roll < 0.99 ? 5 : 10;
    game.drops.push({ id: game.nextId++, x: enemy.x, y: enemy.y, type: "ticket", ticketLevel, life: 30 });
  };

  const onEnemyDefeated = (game: GameState, enemy: Enemy) => {
    game.kills += 1;
    if (enemy.boss) createBossDrop(game, enemy);
    else createDrop(game, enemy);
    const lifestealLevel = game.weapon.installed.lifesteal;
    if (lifestealLevel > 0 && Math.random() < 0.01) {
      game.drops.push({ id: game.nextId++, x: enemy.x, y: enemy.y, type: "heal", life: 25 });
    }
    if (enemy.kind === "splitter") {
      for (let index = 0; index < 2; index += 1) {
        const childHp = Math.max(8, enemy.maxHp * 0.2);
        game.enemies.push({ id: game.nextId++, x: enemy.x + (index === 0 ? -14 : 14), y: enemy.y + (index === 0 ? 10 : -10), radius: 8, hp: childHp, maxHp: childHp, attack: enemy.attack * 0.35, speed: enemy.speed * 1.35, hue: 52, hit: 0, bleedDamage: 0, bleedTimer: 0, kind: "shard", fast: true, shootTimer: 0, abilityTimer: 0, chargeTimer: 0 });
      }
    }
  };

  const hitEnemy = (enemy: Enemy, damage: number, sourceX: number, sourceY: number, force = 8) => {
    enemy.hp -= damage;
    enemy.hit = Math.max(enemy.hit, 0.2);
    playTone(enemy.boss ? 130 : 240, enemy.boss ? 0.06 : 0.035, "square", enemy.boss ? 0.025 : 0.012, 0.72);
    if (enemy.boss) return;
    const distance = Math.hypot(enemy.x - sourceX, enemy.y - sourceY) || 1;
    enemy.x += ((enemy.x - sourceX) / distance) * force;
    enemy.y += ((enemy.y - sourceY) / distance) * force;
  };

  const defeat = useCallback(() => {
    runningRef.current = false;
    setMessage("새벽이 오기 전까지 버텨냈습니다.");
    setGameModal("gameover");
    publishSnapshot();
  }, [publishSnapshot, setGameModal]);

  const updateGame = useCallback((dt: number) => {
    const game = gameRef.current;
    const { player, weapon } = game;
    game.elapsed += dt;
    player.hit = Math.max(0, player.hit - dt);
    const movement = { x: 0, y: 0 };
    if (keysRef.current.w || keysRef.current.arrowup) movement.y -= 1;
    if (keysRef.current.s || keysRef.current.arrowdown) movement.y += 1;
    if (keysRef.current.a || keysRef.current.arrowleft) movement.x -= 1;
    if (keysRef.current.d || keysRef.current.arrowright) movement.x += 1;
    const magnitude = Math.hypot(movement.x, movement.y) || 1;
    const speed = 175 + weapon.installed.range * 4;
    player.x = Math.max(32, Math.min(WIDTH - 32, player.x + (movement.x / magnitude) * speed * dt));
    player.y = Math.max(32, Math.min(HEIGHT - 32, player.y + (movement.y / magnitude) * speed * dt));

    const currentWave = Math.floor(game.elapsed / WAVE_SECONDS) + 1;
    if (game.spawnWave !== currentWave) { game.spawnWave = currentWave; game.spawnedThisWave = 0; }
    game.spawnTimer -= dt;
    const waveBudget = currentWave <= 3 ? 16 + (currentWave - 1) * 12 : currentWave === 4 ? 45 : Math.min(900, 50 + (currentWave - 5) * 30);
    if (game.spawnTimer <= 0 && game.spawnedThisWave < waveBudget && game.enemies.length < 420) {
      const desiredBatch = currentWave <= 5 ? 1 : currentWave <= 7 ? 2 : Math.min(5, 2 + Math.floor((currentWave - 8) / 4));
      const batch = Math.min(desiredBatch, waveBudget - game.spawnedThisWave, 420 - game.enemies.length);
      const spawnEdge = game.spawnEdge;
      for (let i = 0; i < batch; i += 1) spawnEnemy(game, spawnEdge);
      game.spawnEdge = (game.spawnEdge + 1) % 4;
      game.spawnedThisWave += batch;
      game.spawnTimer = currentWave <= 3 ? Math.max(0.75, 0.9 - currentWave * 0.05) : currentWave <= 6 ? Math.max(0.24, 0.42 - (currentWave - 5) * 0.03) : Math.max(0.1, 0.24 - game.elapsed * 0.0007);
    }
    if (currentWave % 5 === 0 && game.lastBossWave !== currentWave) {
      game.lastBossWave = currentWave;
      spawnBoss(game);
      playTone(90, 0.45, "sawtooth", 0.06, 0.45);
    }

    game.fireTimer -= dt;
    if (game.fireTimer <= 0) {
      const pointerAngle = Math.atan2(pointerRef.current.y - player.y, pointerRef.current.x - player.x);
      if (weapon.promotion === "dagger") {
        const arc = Math.min(360, weapon.daggerArc) * Math.PI / 180;
        const targets = game.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) <= weapon.range).filter((enemy) => Math.abs(Math.atan2(Math.sin(Math.atan2(enemy.y - player.y, enemy.x - player.x) - pointerAngle), Math.cos(Math.atan2(enemy.y - player.y, enemy.x - player.x) - pointerAngle))) <= arc / 2).sort((left, right) => Math.hypot(left.x - player.x, left.y - player.y) - Math.hypot(right.x - player.x, right.y - player.y)).slice(0, weapon.daggerHits);
        for (const enemy of targets) { hitEnemy(enemy, weapon.damage, player.x, player.y, enemy.boss ? 2 : 8 + weapon.knockback * 2); if (weapon.bleed > 0) { enemy.bleedDamage = weapon.bleed; enemy.bleedTimer = 3; } if (enemy.hp <= 0) onEnemyDefeated(game, enemy); }
        playTone(180, 0.08, "sawtooth", 0.025, 0.55);
        game.fireTimer = Math.max(0.18, 0.65 - weapon.level * 0.02 - weapon.attackSpeed * 0.045);
      } else if (weapon.promotion === "shotgun") {
        const pelletCount = Math.max(5, weapon.shots);
        const spread = Math.min(0.95, 0.18 + pelletCount * 0.018);
        playTone(150, 0.12, "sawtooth", 0.045, 0.45);
        for (let i = 0; i < pelletCount; i += 1) { const offset = (i - (pelletCount - 1) / 2) * spread; game.bullets.push({ x: player.x, y: player.y, vx: Math.cos(pointerAngle + offset) * 470, vy: Math.sin(pointerAngle + offset) * 470, damage: weapon.damage, life: 1.5, pierce: weapon.pierce, hitIds: [] }); }
        game.fireTimer = Math.max(0.16, 0.68 - weapon.level * 0.02 - weapon.attackSpeed * 0.04);
      } else {
        const targets = game.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) < weapon.range).sort((left, right) => Math.hypot(left.x - player.x, left.y - player.y) - Math.hypot(right.x - player.x, right.y - player.y)).slice(0, weapon.promotion === "machinegun" ? weapon.targetCount : 1);
        if (targets.length > 0) {
          playTone(weapon.promotion === "machinegun" ? 300 : 330, weapon.promotion === "machinegun" ? 0.02 : 0.025, "square", 0.008, 0.62);
          for (const target of targets) { const angle = Math.atan2(target.y - player.y, target.x - player.x); const spread = weapon.shots > 1 ? 0.12 : 0; for (let i = 0; i < weapon.shots; i += 1) { const offset = (i - (weapon.shots - 1) / 2) * spread; game.bullets.push({ x: player.x, y: player.y, vx: Math.cos(angle + offset) * 470, vy: Math.sin(angle + offset) * 470, damage: weapon.damage, life: 1.5, pierce: weapon.pierce, hitIds: [] }); } }
          game.fireTimer = Math.max(0.08, (weapon.promotion === "machinegun" ? 0.28 : 0.62) - weapon.level * 0.02 - weapon.attackSpeed * 0.04);
        } else game.fireTimer = 0.08;
      }
    }

    game.spinAngle += dt * (2.4 + weapon.installed.spin * 0.35);
    game.spinTimer -= dt;
    if (weapon.installed.spin > 0 && game.spinTimer <= 0) {
      const slashRadius = Math.min(190, weapon.range * 0.72 + weapon.installed.spin * 14);
      for (const enemy of game.enemies) {
        if (enemy.hp > 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) < slashRadius) {
          hitEnemy(enemy, weapon.damage * (0.7 + weapon.installed.spin * 0.12), player.x, player.y, enemy.boss ? 2 : 10);
          if (enemy.hp <= 0) onEnemyDefeated(game, enemy);
        }
      }
      game.spinTimer = Math.max(0.55, 1.45 - weapon.installed.spin * 0.08);
    }

    for (const enemy of game.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.shootTimer = Math.max(0, enemy.shootTimer - dt);
      enemy.abilityTimer = Math.max(0, enemy.abilityTimer - dt);
      enemy.chargeTimer = Math.max(0, enemy.chargeTimer - dt);
      if (enemy.bleedTimer > 0) { enemy.bleedTimer -= dt; enemy.hp -= enemy.bleedDamage * dt; if (enemy.hp <= 0) onEnemyDefeated(game, enemy); }
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (!enemy.boss && enemy.kind === "charger" && enemy.abilityTimer <= 0) {
        enemy.abilityTimer = 3.4; enemy.chargeTimer = 0.7; enemy.hit = 0.35;
      }
      if (!enemy.boss && enemy.kind === "shooter" && enemy.shootTimer <= 0) {
        const angle = Math.atan2(dy, dx);
        game.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190, damage: Math.min(12, enemy.attack * 0.55), life: 3.5 });
        enemy.shootTimer = 2.1;
      }
      if (enemy.boss && enemy.bossKind === "summoner" && enemy.abilityTimer <= 0) {
        for (let index = 0; index < 2; index += 1) {
          const angle = index * Math.PI + game.elapsed;
          const minionHp = Math.max(30, enemy.maxHp * 0.06);
          game.enemies.push({ id: game.nextId++, x: enemy.x + Math.cos(angle) * 48, y: enemy.y + Math.sin(angle) * 48, radius: 11, hp: minionHp, maxHp: minionHp, attack: enemy.attack * 0.42, speed: 38, hue: 112, hit: 0, bleedDamage: 0, bleedTimer: 0, kind: "shooter", shootTimer: 1.4, abilityTimer: 0, chargeTimer: 0 });
        }
        enemy.abilityTimer = 4.5;
      }
      if (enemy.boss && enemy.bossKind === "storm" && enemy.abilityTimer <= 0) {
        const stormLevel = Math.max(0, Math.floor(game.elapsed / WAVE_SECONDS) - 1);
        for (let index = 0; index < 8; index += 1) {
          const angle = index * (Math.PI / 4);
          game.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 210, vy: Math.sin(angle) * 210, damage: Math.min(5, 2 + stormLevel * 0.1), life: 3.4 });
        }
        enemy.abilityTimer = 3.8;
      }
      if (enemy.boss && enemy.shootTimer <= 0) {
        const angle = Math.atan2(dy, dx);
        const bossWave = Math.floor(game.elapsed / WAVE_SECONDS) + 1;
        const barrageLevel = Math.max(0, bossWave - 5);
        const barrageCount = Math.min(9, 4 + Math.floor(barrageLevel / 5));
        const bulletSpeed = 260 + Math.min(150, barrageLevel * 10);
        const bulletDamage = Math.min(5, 2 + barrageLevel * 0.1 + Math.random() * 0.4);
        for (let index = 0; index < barrageCount; index += 1) {
          const offset = (index - (barrageCount - 1) / 2) * 0.18;
          game.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle + offset) * bulletSpeed, vy: Math.sin(angle + offset) * bulletSpeed, damage: bulletDamage, life: 4.5 });
        }
        enemy.shootTimer = Math.max(0.28, 0.62 - barrageLevel * 0.018);
      }
      if (distance > player.radius + enemy.radius - 3) {
        const moveSpeed = enemy.chargeTimer > 0 ? enemy.speed * 2.4 : enemy.speed;
        enemy.x += (dx / distance) * moveSpeed * dt;
        enemy.y += (dy / distance) * moveSpeed * dt;
      } else if (player.hit <= 0) {
        playTone(75, 0.11, "square", 0.04, 0.55);
        player.hp -= enemy.attack;
        player.hit = 0.5;
        if (player.hp <= 0) { player.hp = 0; defeat(); return; }
      }
    }

    game.bullets = game.bullets.filter((bullet) => {
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      if (bullet.life <= 0) return false;
      for (const enemy of game.enemies) {
        if (enemy.hp > 0 && !bullet.hitIds.includes(enemy.id) && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + 6) {
          bullet.hitIds.push(enemy.id);
          hitEnemy(enemy, bullet.damage, player.x, player.y, enemy.boss ? 2 : 7);
          if (enemy.hp <= 0) onEnemyDefeated(game, enemy);
          if (bullet.pierce > 0) { bullet.pierce -= 1; return true; }
          return false;
        }
      }
      return true;
    });
    game.enemyBullets = game.enemyBullets.filter((bullet) => {
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      if (bullet.life <= 0) return false;
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.radius + 8) {
        if (player.hit <= 0) { playTone(95, 0.09, "square", 0.035, 0.5); player.hp -= bullet.damage; player.hit = 0.35; if (player.hp <= 0) { player.hp = 0; defeat(); } }
        return false;
      }
      return true;
    });
    if (!runningRef.current) return;
    game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
    game.drops = game.drops.filter((drop) => {
      drop.life -= dt;
      if (drop.life <= 0) return false;
      const distance = Math.hypot(drop.x - player.x, drop.y - player.y);
      const magnetRadius = 65 + weapon.installed.magnet * 48;
      if (drop.type !== "heal" && weapon.installed.magnet > 0 && distance > 29 && distance < magnetRadius) {
        const pull = 115 + weapon.installed.magnet * 22;
        drop.x += ((player.x - drop.x) / distance) * pull * dt;
        drop.y += ((player.y - drop.y) / distance) * pull * dt;
      }
      if (Math.hypot(drop.x - player.x, drop.y - player.y) < 29) {
        playTone(drop.type === "heal" ? 620 : drop.type === "core" ? 440 : drop.type === "part" ? 360 : 260, 0.08, "sine", 0.025, 1.5);
        if (drop.type === "coin") game.coins += 1 + game.weapon.installed.income;
        if (drop.type === "core") game.cores += 1;
        if (drop.type === "part" && drop.part) game.parts[drop.part] += 1;
        if (drop.type === "ticket" && drop.ticketLevel) game.upgradeTickets[drop.ticketLevel] += 1;
        if (drop.type === "heal") game.player.hp = Math.min(game.player.maxHp, game.player.hp + 5);
        return false;
      }
      return true;
    });

    if (Math.floor(game.elapsed * 10) % 2 === 0) publishSnapshot();
  }, [defeat, playTone, publishSnapshot, setGameModal]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const game = gameRef.current;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const background = ctx.createRadialGradient(WIDTH * 0.55, HEIGHT * 0.4, 0, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.8);
    background.addColorStop(0, "#19243d"); background.addColorStop(1, "#090d1c"); ctx.fillStyle = background; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "rgba(102, 126, 173, .11)"; ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const stars = [[42, 82], [140, 220], [270, 72], [402, 160], [612, 90], [820, 180], [904, 420], [700, 510], [90, 490], [500, 550]];
    ctx.fillStyle = "#dce8ff"; for (const [x, y] of stars) { ctx.globalAlpha = .25 + ((Math.sin(game.elapsed * 2 + x) + 1) / 2) * .4; ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(game.player.x, game.player.y, game.weapon.range, 0, Math.PI * 2); ctx.fillStyle = "rgba(104, 226, 236, .025)"; ctx.fill();
    if (game.weapon.installed.magnet > 0) {
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, 65 + game.weapon.installed.magnet * 48, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255, 215, 107, .16)"; ctx.lineWidth = 2; ctx.setLineDash([5, 9]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (game.weapon.installed.spin > 0) {
      ctx.save(); ctx.translate(game.player.x, game.player.y); ctx.rotate(game.spinAngle); ctx.strokeStyle = "rgba(231, 177, 255, .75)"; ctx.lineWidth = 4; ctx.shadowBlur = 18; ctx.shadowColor = "#df8dff"; ctx.beginPath(); ctx.arc(0, 0, Math.min(190, game.weapon.range * 0.72 + game.weapon.installed.spin * 14), -0.45, 0.85); ctx.stroke(); ctx.restore();
    }
    for (const drop of game.drops) {
      ctx.save(); ctx.translate(drop.x, drop.y); ctx.shadowBlur = 15; ctx.shadowColor = drop.type === "heal" ? "#7dff9a" : drop.type === "coin" ? "#ffd76b" : drop.type === "core" ? "#d49bff" : "#6ce8ff";
      if (drop.type === "coin") { ctx.fillStyle = "#ffd76b"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#8f5c17"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.fillText("₩", 0, 4); }
      else if (drop.type === "ticket") { ctx.fillStyle = "#ffcc73"; ctx.rotate(Math.PI / 4); ctx.fillRect(-9, -9, 18, 18); ctx.rotate(-Math.PI / 4); ctx.fillStyle = "#36223f"; ctx.font = "bold 9px Arial"; ctx.textAlign = "center"; ctx.fillText(String(drop.ticketLevel ?? 1), 0, 3); }
      else if (drop.type === "heal") { ctx.fillStyle = "#7dff9a"; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#14542d"; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
      else { ctx.fillStyle = drop.type === "core" ? "#d49bff" : "#6ce8ff"; ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); }
      ctx.restore();
    }
    for (const bullet of game.bullets) { ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff3b0"; ctx.shadowBlur = 13; ctx.shadowColor = "#ffc85d"; ctx.fill(); ctx.shadowBlur = 0; }
    for (const bullet of game.enemyBullets) { ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2); ctx.fillStyle = "#ff3b6d"; ctx.shadowBlur = 22; ctx.shadowColor = "#ff174f"; ctx.fill(); ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff1f5"; ctx.shadowBlur = 0; ctx.fill(); }
    for (const enemy of game.enemies) {
      ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.shadowBlur = enemy.boss ? 26 : enemy.fast ? 18 : 12; ctx.shadowColor = enemy.boss ? "#ff8ee7" : enemy.fast ? "#ffb347" : `hsl(${enemy.hue} 80% 60% / .6)`; ctx.fillStyle = enemy.hit > 0 ? "#fff" : enemy.boss ? "#a75ad1" : enemy.fast ? "#e27542" : `hsl(${enemy.hue} 57% 46%)`; ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#180f29"; ctx.beginPath(); ctx.arc(-4, -2, 2.5, 0, Math.PI * 2); ctx.arc(4, -2, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f8aac6"; ctx.beginPath(); ctx.arc(-4, -2, 1, 0, Math.PI * 2); ctx.arc(4, -2, 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (enemy.boss) { ctx.strokeStyle = "#ffb2eb"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2); ctx.stroke(); }
      if (enemy.boss && enemy.bossKind !== "normal") { ctx.strokeStyle = enemy.bossKind === "storm" ? "#69c7ff" : "#a8ff76"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 13, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#351d45"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 3); ctx.fillStyle = "#ff7e9e"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2 * Math.max(0, enemy.hp / enemy.maxHp), 3);
    }
    ctx.save(); ctx.translate(game.player.x, game.player.y); ctx.shadowBlur = 24; ctx.shadowColor = "#57e2e9"; ctx.fillStyle = game.player.hit > 0 ? "#fff" : "#68e2ec"; ctx.beginPath(); ctx.arc(0, 0, game.player.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#0c1930"; ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(0, 25); ctx.lineTo(18, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff5bd"; ctx.beginPath(); ctx.arc(-5, -3, 2, 0, Math.PI * 2); ctx.arc(5, -3, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }, []);

  useEffect(() => {
    const movePointer = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = { x: ((event.clientX - rect.left) / rect.width) * WIDTH, y: ((event.clientY - rect.top) / rect.height) * HEIGHT };
    };
    window.addEventListener("mousemove", movePointer);
    return () => window.removeEventListener("mousemove", movePointer);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      ensureAudio();
      const key = event.key.toLowerCase(); keysRef.current[key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (key === "q" && !event.repeat && modalRef.current === "upgrade") {
        setSelectedParts(selectAllPartsMode ? getAvailablePartTypes(gameRef.current.weapon.promotion).filter((part) => gameRef.current.parts[part] > 0) : []);
        setSelectedTicket(null); setAttemptBoost(0); setResult([]); setGameModal(null);
      } else if (key === "q" && !event.repeat && !modalRef.current) {
        const current = gameRef.current;
        const ticketAvailable = Object.values(current.upgradeTickets).some((count) => count > 0);
        if (current.coins >= upgradeCost(current.weapon.level) || ticketAvailable) { setSelectedParts(selectAllPartsMode ? getAvailablePartTypes(current.weapon.promotion).filter((part) => current.parts[part] > 0) : []); setSelectedTicket(null); setAttemptBoost(0); setResult([]); setGameModal("upgrade"); }
        else setMessage("강화에 필요한 돈이나 강화권이 없습니다.");
      }
    };
    const up = (event: KeyboardEvent) => { keysRef.current[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    let previous = performance.now();
    const frame = (now: number) => { const dt = Math.min(0.05, (now - previous) / 1000); previous = now; if (runningRef.current && !pausedRef.current) updateGame(dt); draw(); animationRef.current = requestAnimationFrame(frame); };
    animationRef.current = requestAnimationFrame(frame);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [draw, ensureAudio, selectAllPartsMode, setGameModal, updateGame]);

  const togglePart = (part: PartType) => setSelectedParts((current) => current.includes(part) ? current.filter((item) => item !== part) : [...current, part]);
  const useCore = () => { if (gameRef.current.cores > 0 && attemptBoost < 10) { gameRef.current.cores -= 1; setAttemptBoost((value) => value + 5); publishSnapshot(); } };
  const enhance = () => {
    const game = gameRef.current; const cost = upgradeCost(game.weapon.level); const ticket = selectedTicket && game.upgradeTickets[selectedTicket] > 0 ? selectedTicket : null; if (game.coins < cost && !ticket) return;
    const autoCoreCount = autoUseCores ? Math.min(game.cores, Math.floor((10 - attemptBoost) / 5)) : 0;
    if (autoCoreCount > 0) game.cores -= autoCoreCount;
    if (ticket) game.upgradeTickets[ticket] -= 1; else game.coins -= cost;
    const boost = attemptBoost + autoCoreCount * 5; const logs: string[] = [];
    if (ticket) {
      const levels = ticket; game.weapon.level += levels; game.weapon.damage += 8 * levels; game.weapon.range += 28 * levels; game.highestWeaponLevel = Math.max(game.highestWeaponLevel, game.weapon.level); logs.push(`${levels}레벨 확정 강화권 사용 · 무기 레벨 ${game.weapon.level}`);
    } else {
      const wChance = Math.min(99, weaponChance(game.weapon) + boost); const weaponSuccess = Math.random() * 100 < wChance; const regression = game.weapon.level > 0 && Math.random() < 0.005;
      if (regression) {
        game.weapon.level -= 1; game.weapon.damage = Math.max(22, game.weapon.damage - 8); game.weapon.range = Math.max(230, game.weapon.range - 28); logs.push("0.5% 확률 발동 · 무기가 1레벨 회귀했습니다");
      } else if (weaponSuccess) {
        const levels = Math.random() < 0.002 ? 2 : 1; game.weapon.level += levels; game.weapon.damage += 8 * levels; game.weapon.range += 28 * levels; game.highestWeaponLevel = Math.max(game.highestWeaponLevel, game.weapon.level); logs.push(levels === 2 ? "대박! 0.2% 확률로 2레벨 강화 성공" : "무기 강화 성공 · 공격력 +8 · 사거리 +28");
      } else if (game.weapon.level > 0 && Math.random() < 0.05) {
        game.weapon.level -= 1; game.weapon.damage = Math.max(22, game.weapon.damage - 8); game.weapon.range = Math.max(230, game.weapon.range - 28); logs.push(`무기 강화 실패 · 무기 레벨이 ${game.weapon.level}로 하락했습니다`);
      } else if (game.weapon.level > 0) logs.push(`무기 강화 실패 · ${wChance}% 확률을 넘지 못했지만 레벨은 유지됩니다`);
      else logs.push(`무기 강화 실패 · ${wChance}% 확률을 넘지 못했습니다`);
    }
    for (const part of selectedParts) {
      if (game.parts[part] <= 0) continue;
      if (part === "income" && (game.weapon.level < 30 || game.weapon.installed.income >= 1)) {
        logs.push(game.weapon.level < 30 ? "돈 수급량 파츠는 무기 LV.30부터 부착할 수 있습니다" : "돈 수급량 파츠는 1회만 부착할 수 있습니다");
        continue;
      }
      game.parts[part] -= 1; const chance = Math.min(95, partChance(game.weapon, part) + boost); const success = Math.random() * 100 < chance;
      if (success) {
        game.weapon.installed[part] += 1;
        if (part === "shots") game.weapon.shots += 1;
        if (part === "damage") game.weapon.damage += 10;
        if (part === "range") game.weapon.range += 52;
        if (part === "spin") game.weapon.range += 18;
        if (part === "shotSpread") { if (game.weapon.shots < 10) game.weapon.shots += 1; else game.weapon.damage += 6; }
        if (part === "shotCount") game.weapon.shots += 1;
        if (part === "pierce") game.weapon.pierce += 1;
        if (part === "knockback") game.weapon.knockback += 1;
        if (part === "attackSpeed") game.weapon.attackSpeed += 1;
        if (part === "daggerArc") { if (game.weapon.daggerArc < 360) game.weapon.daggerArc = Math.min(360, game.weapon.daggerArc + 10); else game.weapon.damage += 6; }
        if (part === "daggerHits") game.weapon.daggerHits += 1;
        if (part === "bleed") game.weapon.bleed += 3;
        if (part === "targetCount") game.weapon.targetCount += 1;
        logs.push(`${PART_LABELS[part]} 부착 성공 · ${chance}%`);
      }
      else logs.push(`${PART_LABELS[part]} 부착 실패 · ${chance}%`);
    }
    setAttemptBoost(0); setSelectedParts(selectAllPartsMode ? getAvailablePartTypes(game.weapon.promotion).filter((part) => game.parts[part] > 0) : []); setSelectedTicket(null); setResult(logs); setMessage("강화 결과를 확인하세요."); if (game.weapon.level >= 5 && !game.weapon.promotion) setGameModal("promotion"); publishSnapshot();
  };
  const promote = (promotion: WeaponClass) => {
    const game = gameRef.current;
    if (game.weapon.level < 5 || game.weapon.promotion) return;
    game.weapon.promotion = promotion;
    game.weapon.shots = promotion === "shotgun" ? 5 : 1;
    game.weapon.daggerArc = promotion === "dagger" ? 60 : 0;
    game.weapon.daggerHits = promotion === "dagger" ? 1 : 0;
    game.weapon.targetCount = promotion === "machinegun" ? 1 : 0;
    game.weapon.attackSpeed = promotion === "machinegun" ? 2 : 0;
    game.weapon.pierce = 0;
    game.weapon.knockback = 0;
    game.weapon.bleed = 0;
    setSelectedParts([]); setSelectAllPartsMode(false); setResult([]); setMessage(`${promotion === "shotgun" ? "샷건" : promotion === "dagger" ? "대거" : "기관총"}으로 전직했습니다.`); setGameModal(null); playTone(280, 0.3, "triangle", 0.05, 1.8); publishSnapshot();
  };
  const restart = () => { gameRef.current = makeGame(); runningRef.current = true; setResult([]); setSelectedParts([]); setSelectAllPartsMode(false); setAutoUseCores(false); setSelectedTicket(null); setAttemptBoost(0); setMessage("어둠이 깨어났습니다. 살아남으세요."); setGameModal(null); publishSnapshot(); };
  const pressKey = (key: string, value: boolean) => { if (value) ensureAudio(); keysRef.current[key] = value; };
  const cost = upgradeCost(snapshot.weapon.level);
  const currentWeaponChance = Math.min(99, weaponChance(snapshot.weapon) + attemptBoost);
  const currentWeaponFailChance = 100 - currentWeaponChance;
  const totalParts = PART_TYPES.reduce((sum, part) => sum + snapshot.parts[part], 0);
  const totalTickets = TICKET_LEVELS.reduce((sum, level) => sum + snapshot.upgradeTickets[level], 0);
  const availableParts = getAvailablePartTypes(snapshot.weapon.promotion);
  const ownedParts = availableParts.filter((part) => snapshot.parts[part] > 0);
  const allPartsSelected = selectAllPartsMode;
  const toggleAllParts = () => {
    setSelectAllPartsMode((enabled) => !enabled);
    setSelectedParts(allPartsSelected ? [] : ownedParts);
  };
  const nextStats = useMemo(() => ({ damage: snapshot.weapon.damage + 8, range: snapshot.weapon.range + 28 }), [snapshot.weapon.damage, snapshot.weapon.range]);

  return (
    <main className="night-page">
      <div className="night-shell">
        <header className="night-header">
          <div><p className="night-kicker">NIGHTFALL PROTOCOL · RUN 01</p><h1>Vampire <em>Survivor</em></h1></div>
          <div className="night-header-right"><span className="live-pill"><i /> LIVE RUN</span><span className="night-tip">WASD / 방향키 이동 · Q 강화</span></div>
        </header>
        <section className="survival-layout">
          <aside className="survival-sidebar">
            <div className="survival-card status-card"><div className="hero-chip">✦</div><div><p className="card-label">HUNTER</p><strong>DemoTest</strong></div><div className="health-track"><span style={{ width: `${(snapshot.player.hp / snapshot.player.maxHp) * 100}%` }} /></div><small>HP {Math.ceil(snapshot.player.hp)} / {snapshot.player.maxHp}</small></div>
            <div className="survival-card weapon-card"><p className="card-label">AUTO WEAPON</p><div className="weapon-title"><span className="weapon-icon">☄</span><div><strong>Moon Shard</strong><small>LV.{snapshot.weapon.level}</small></div></div><div className="weapon-stats"><span>DMG <b>{snapshot.weapon.damage}</b></span><span>RANGE <b>{snapshot.weapon.range}</b></span><span>SHOTS <b>{snapshot.weapon.shots}</b></span></div></div>
            <div className="survival-card resource-card"><p className="card-label">COLLECTED</p><div className="resource-line"><span className="resource-coin">₩</span><div><small>돈</small><strong>{snapshot.coins}</strong></div><span className="resource-core">✦</span><div><small>성공 코어</small><strong>{snapshot.cores}</strong></div></div><div className="part-count"><span>파츠 보유</span><b>{totalParts}</b></div></div>
            <div className="sidebar-copy"><span>DROP RATE</span><p><b>85%</b> 돈 · <b>13%</b> 파츠 · <b>2%</b> 성공 코어</p></div>
          </aside>
          <section className="arena-column"><div className="arena-topbar"><div><span className="arena-label">SURVIVAL ARENA</span><strong>{formatTime(snapshot.elapsed)}</strong></div><div className="run-stat"><span>처치</span><b>{snapshot.kills}</b></div><div className="run-stat"><span>웨이브</span><b>{Math.floor(snapshot.elapsed / WAVE_SECONDS) + 1}</b></div></div><div className="arena-wrap"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="뱀파이어 서바이벌 아레나" /><div className="arena-vignette" /><div className="touch-controls"><button onPointerDown={() => pressKey("w", true)} onPointerUp={() => pressKey("w", false)} onPointerLeave={() => pressKey("w", false)}>▲</button><div><button onPointerDown={() => pressKey("a", true)} onPointerUp={() => pressKey("a", false)} onPointerLeave={() => pressKey("a", false)}>◀</button><button onPointerDown={() => pressKey("s", true)} onPointerUp={() => pressKey("s", false)} onPointerLeave={() => pressKey("s", false)}>▼</button><button onPointerDown={() => pressKey("d", true)} onPointerUp={() => pressKey("d", false)} onPointerLeave={() => pressKey("d", false)}>▶</button></div></div></div><div className="arena-footer"><span><i className="legend-dot coin" /> 돈</span><span><i className="legend-dot part" /> 강화 파츠</span><span><i className="legend-dot core" /> 성공 코어</span><span><i className="legend-dot heal" /> 회복 구슬</span><b>{message}</b></div></section>
        </section>
        <footer className="night-footer"><span>MOVE · SURVIVE · ENHANCE</span><span>THE NIGHT REMEMBERS EVERY RUN</span></footer>
      </div>
      {modal === "upgrade" && <div className="modal-backdrop"><section className="enhance-modal"><div className="modal-heading"><div><p className="night-kicker">WORKSHOP / WEAPON ENHANCE</p><h2>무기를 <em>강화하세요</em></h2></div><span className="cost-badge">₩ {cost}</span></div><div className="enhance-compare"><div><small>CURRENT</small><strong>LV.{snapshot.weapon.level}</strong><span>DMG {snapshot.weapon.damage} · RANGE {snapshot.weapon.range}</span></div><b>→</b><div className="next"><small>ON SUCCESS</small><strong>LV.{snapshot.weapon.level + 1}</strong><span>DMG {nextStats.damage} · RANGE {nextStats.range}</span></div></div><div className="chance-panel"><div><span>무기 강화 성공확률</span><strong>{currentWeaponChance}%</strong></div><div className="chance-track"><i style={{ width: `${currentWeaponChance}%` }} /></div><small>강화 레벨이 오를수록 기본 확률이 내려갑니다.</small></div><div className="parts-heading"><div><p className="night-kicker">OPTIONAL PARTS</p><h3>파츠를 함께 넣기</h3></div><button className={`core-use ${attemptBoost ? "used" : ""}`} onClick={useCore} disabled={snapshot.cores === 0 || attemptBoost >= 10}>✦ 성공 코어 +5% {attemptBoost ? `(${attemptBoost}%)` : ""}</button></div><div className="part-grid">{availableParts.map((part) => { const chance = Math.min(95, partChance(snapshot.weapon, part) + attemptBoost); const selected = selectedParts.includes(part); const incomeLocked = part === "income" && (snapshot.weapon.level < 30 || snapshot.weapon.installed.income >= 1); return <button key={part} className={`part-option ${selected ? "chosen" : ""}`} onClick={() => togglePart(part)} disabled={snapshot.parts[part] === 0 || incomeLocked}><span className="part-symbol">{PART_ICONS[part]}</span><span><strong>{PART_LABELS[part]}</strong><small>{incomeLocked ? (snapshot.weapon.level < 30 ? "무기 LV.30 필요" : "1회 설치 완료") : `보유 ${snapshot.parts[part]} · 성공 ${chance}%`}</small></span><i>{selected ? "✓" : "+"}</i></button>; })}</div>{result.length > 0 && <div className="enhance-result">{result.map((line) => <p key={line}>{line}</p>)}</div>}<button className="enhance-button" onClick={enhance}>강화 시도 <span>₩ {cost}</span></button></section></div>}
      {modal === "upgrade" && totalTickets > 0 && <div className="ticket-dock"><span>확정 강화권</span>{TICKET_LEVELS.map((level) => <button key={level} className={selectedTicket === level ? "active" : ""} disabled={snapshot.upgradeTickets[level] === 0} onClick={() => setSelectedTicket(selectedTicket === level ? null : level)}>{level}LV <small>x{snapshot.upgradeTickets[level]}</small></button>)}</div>}
      {modal === "upgrade" && <button className={`parts-select-dock ${allPartsSelected ? "active" : ""}`} onClick={toggleAllParts}>{allPartsSelected ? "보유 파츠 전체 해제" : "보유 파츠 전부 선택"}</button>}
      {modal === "upgrade" && <div className="chance-dock"><span>현재 강화확률</span><b>성공 {currentWeaponChance}%</b><i>실패 {currentWeaponFailChance}%</i></div>}
      {modal === "promotion" && <div className="modal-backdrop"><section className="promotion-modal"><p className="night-kicker">CLASS CHANGE / LV.5</p><h2>전직을 <em>선택하세요</em></h2><p className="promotion-copy">무기 공격 방식과 전용 파츠가 바뀝니다. 공격력·자석·돈 수급은 계속 유지됩니다.</p><div className="promotion-grid"><button className="promotion-option" onClick={() => promote("shotgun")}><strong>샷건</strong><span>마우스 방향 5갈래 발사</span><small>갈래 · 타수 · 관통 · 넉백 · 공속</small></button><button className="promotion-option" onClick={() => promote("dagger")}><strong>대거</strong><span>마우스 방향 60° 베기</span><small>각도 · 타수 · 출혈 · 공속</small></button><button className="promotion-option" onClick={() => promote("machinegun")}><strong>기관총</strong><span>가까운 적 집중 공격</span><small>빠른 공속 · 공격 목표 추가</small></button></div></section></div>}
      {modal === "gameover" && <div className="modal-backdrop"><section className="gameover-modal"><p className="night-kicker">RUN COMPLETE</p><h2>밤을 <em>지배했습니다.</em></h2><p>{formatTime(snapshot.elapsed)} 동안 {snapshot.kills}마리 처치 · 최종 무기 LV.{snapshot.weapon.level}</p><button className="enhance-button" onClick={restart}>다시 시작하기</button></section></div>}
      {modal === "upgrade" && <button className={`core-auto-dock ${autoUseCores ? "active" : ""}`} onClick={() => setAutoUseCores((enabled) => !enabled)}>성공 코어 자동 사용 · {autoUseCores ? "ON" : "OFF"}</button>}
      {modal === "upgrade" && <div className="balance-dock">남은 돈 ₩ {snapshot.coins}</div>}
      <div className="next-cost-hud">다음 강화까지 ₩ {Math.max(0, cost - snapshot.coins)}</div>
    </main>
  );
}
