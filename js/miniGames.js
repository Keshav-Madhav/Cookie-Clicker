import { formatNumberInWords } from "./utils.js";
import { MINI_GAME_REWARDS } from "./config.js";
import { runCookieAlchemy } from "./cookieAlchemy.js";

// Individual game mixins
import { SlotMachineMixin } from "./games/slotMachine.js";
import { SpeedClickMixin } from "./games/speedClick.js";
import { CookieCatchMixin } from "./games/cookieCatch.js";
import { TriviaMixin } from "./games/trivia.js";
import { EmojiMemoryMixin } from "./games/emojiMemory.js";
import { CookieCutterMixin } from "./games/cookieCutter.js";
import { CookieDefenseMixin } from "./games/cookieDefense.js";
import { GrandmasKitchenMixin } from "./games/grandmasKitchen.js";
import { MathBakerMixin } from "./games/mathBaker.js";
import { DungeonCrawlMixin } from "./games/dungeonCrawl.js";
import { SafeCrackerMixin } from "./games/safeCracker.js";
import { CookieLaunchMixin } from "./games/cookieLaunch.js";
import { CookieWordleMixin } from "./games/cookieWordle.js";
import { CookieAssemblyMixin } from "./games/cookieAssembly.js";

/**
 * MiniGames — core class handling rewards, overlay, and game selection.
 * Individual games are mixed in from js/games/*.js
 */
export class MiniGames {
  constructor(game) {
    this.game = game;
    this._active = false;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._active) {
        e.preventDefault();
        e.stopPropagation();
        this._close();
      }
    });
  }

  init() {
    const btn = document.getElementById("news-play");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._active) return;
      this.game.soundManager.newsPlayDice();

      const games = [
        ['slots',          () => this._slotMachine()],
        ['speed',          () => this._speedClick()],
        ['catch',          () => this._cookieCatch()],
        ['trivia',         () => this._trivia()],
        ['memory',         () => this._emojiMemory()],
        ['cookieCutter',   () => this._cookieCutter()],
        ['cookieDefense',  () => this._cookieDefense()],
        ['grandmasKitchen',() => this._grandmasKitchen()],
        ['mathBaker',      () => this._mathBaker()],
        ['dungeon',        () => this._dungeonCrawl()],
        ['safeCracker',    () => this._safeCracker()],
        ['cookieLaunch',   () => this._cookieLaunch()],
        ['cookieWordle',   () => this._cookieWordle()],
        ['cookieAssembly', () => this._cookieAssembly()],
        ['cookieAlchemy',  () => this._cookieAlchemy()],
      ];
      const [name, launch] = games[Math.floor(Math.random() * games.length)];
      this._currentGameName = name;
      this._currentGameRewarded = false;
      launch();

      btn.classList.add("dice-spin");
      setTimeout(() => btn.classList.remove("dice-spin"), 600);
    });
  }

  _giveReward(tier = "normal", gameName = "") {
    const g = this.game;
    const cps = g.getEffectiveCPS();
    const clicks = g.stats.totalClicks;
    const buildings = g.getTotalBuildingCount();
    const prestige = g.prestige.getSpendableChips() || 0;

    const cpsMult    = MINI_GAME_REWARDS.cpsMultiplier[tier]      || MINI_GAME_REWARDS.cpsMultiplier.normal;
    const clickMult  = MINI_GAME_REWARDS.clickMultiplier[tier]    || MINI_GAME_REWARDS.clickMultiplier.normal;
    const empireMult = MINI_GAME_REWARDS.empireMultiplier[tier]   || MINI_GAME_REWARDS.empireMultiplier.normal;
    const prestMult  = MINI_GAME_REWARDS.prestigeMultiplier[tier] || MINI_GAME_REWARDS.prestigeMultiplier.normal;

    const raw = cps.toNumber() * cpsMult
              + Math.sqrt(clicks) * clickMult
              + buildings * empireMult
              + prestige * prestMult;

    const cookiesNum = Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, g.cookies.toNumber()));
    const scaling = raw / (raw + cookiesNum);
    const tierScale = MINI_GAME_REWARDS.tierScale[tier] || MINI_GAME_REWARDS.tierScale.normal;
    const floor = MINI_GAME_REWARDS.floor[tier] || MINI_GAME_REWARDS.floor.normal;

    let reward = Math.max(cookiesNum * scaling * tierScale, floor);
    reward *= (g.miniGameBonus || 1);
    reward = Math.floor(reward);

    g.cookies = g.cookies.add(reward);
    g.stats.totalCookiesBaked = g.stats.totalCookiesBaked.add(reward);
    g.updateCookieCount();
    if (g.visualEffects) g.visualEffects.triggerIncomeRain(reward);
    g.soundManager.miniGameWin();

    if (gameName && g.stats.miniGamesWon) {
      if (!g.stats.miniGamesWon.includes(gameName)) {
        g.stats.miniGamesWon.push(gameName);
      }
    }

    g.stats.miniGamesPlayed = (g.stats.miniGamesPlayed || 0) + 1;

    if (gameName) {
      if (!g.stats.perGame) g.stats.perGame = {};
      if (!g.stats.perGame[gameName]) g.stats.perGame[gameName] = { played: 0, wins: 0, totalReward: 0, bestReward: 0 };
      const pg = g.stats.perGame[gameName];
      pg.played++;
      pg.wins++;
      pg.totalReward += reward;
      if (reward > pg.bestReward) pg.bestReward = reward;
      this._currentGameRewarded = true;
    }

    if (g.stats.miniGamesPlayed === 100 && g.tutorial) {
      g.tutorial.triggerEvent('miniGameAddict');
    }

    g.achievementManager.check();
    return reward;
  }

  _show(html) {
    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return null;
    this._active = true;
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
    overlay.classList.add("mini-game-enter");
    setTimeout(() => overlay.classList.remove("mini-game-enter"), 400);
    this.game.soundManager.panelOpen();
    return overlay;
  }

  _close() {
    if (!this._active) return;
    this._active = false;

    if (this._currentGameName && !this._currentGameRewarded) {
      const g = this.game;
      if (!g.stats.perGame) g.stats.perGame = {};
      if (!g.stats.perGame[this._currentGameName]) g.stats.perGame[this._currentGameName] = { played: 0, wins: 0, totalReward: 0, bestReward: 0 };
      g.stats.perGame[this._currentGameName].played++;
      g.stats.miniGamesPlayed = (g.stats.miniGamesPlayed || 0) + 1;
    }
    this._currentGameName = '';
    this._currentGameRewarded = false;

    if (this._activeCleanup) {
      try { this._activeCleanup(); } catch (_) {}
      this._activeCleanup = null;
    }

    document.getElementById('dng-tooltip')?.remove();
    document.getElementById('wordle-tooltip')?.remove();
    const gt = document.getElementById('global-tooltip');
    if (gt) gt.style.opacity = '0';

    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return;
    this.game.soundManager.panelClose();
    overlay.classList.add("mini-game-exit");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("mini-game-exit");
      overlay.innerHTML = "";
    }, 300);
  }

  _cookieAlchemy() { runCookieAlchemy(this); }
}

// Mix in all game implementations
Object.assign(MiniGames.prototype,
  SlotMachineMixin, SpeedClickMixin, CookieCatchMixin, TriviaMixin, EmojiMemoryMixin,
  CookieCutterMixin, CookieDefenseMixin, GrandmasKitchenMixin, MathBakerMixin,
  DungeonCrawlMixin, SafeCrackerMixin, CookieLaunchMixin, CookieWordleMixin, CookieAssemblyMixin
);
