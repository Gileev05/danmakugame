import { EnemyManager } from './EnemyManager';
import { ItemManager } from './ItemManager';
import { ShotSystem } from './ShotSystem';
import {
  ABILITY_BLANK_SILENCE_MS,
  ABILITY_BOOST_DURATION_MS,
  ABILITY_BOOST_FIRE_RATE_MULTIPLIER,
  ABILITY_OPTIONS,
} from './constants';
import { AbilityOption, AbilityType } from './types';

/**
 * Активная способность игрока (X или ПКМ): одна из ABILITY_OPTIONS.
 * Чтобы добавить новую способность:
 *  1. добавь AbilityType в types.ts;
 *  2. добавь строку в ABILITY_OPTIONS в constants.ts;
 *  3. добавь обработчик в this.handlers ниже;
 *  4. добавь иконку в MenuManager.createAbilityIcon.
 */
export class AbilityManager {
  private enemyManager: EnemyManager;
  private itemManager: ItemManager;
  private shotSystem: ShotSystem;
  private isTriggerDown: () => boolean;
  private onHeal: () => boolean;

  private option: AbilityOption | null = null;
  private cooldownMs = 0;
  private boostMs = 0;
  private xWasDown = false;
  private readonly handlers: Record<AbilityType, () => boolean>;

  constructor(
    enemyManager: EnemyManager,
    itemManager: ItemManager,
    shotSystem: ShotSystem,
    isTriggerDown: () => boolean,
    onHeal: () => boolean,
  ) {
    this.enemyManager = enemyManager;
    this.itemManager = itemManager;
    this.shotSystem = shotSystem;
    this.isTriggerDown = isTriggerDown;
    this.onHeal = onHeal;

    this.handlers = {
      blank: () => this.activateBlank(),
      medkit: () => this.activateMedkit(),
      boost: () => this.activateBoost(),
    };
  }

  get selected(): AbilityType | null {
    return this.option?.ability ?? null;
  }

  get selectedName(): string {
    return this.option?.name ?? '';
  }

  get cooldownRemainingMs(): number {
    return this.cooldownMs;
  }

  get cooldownTotalMs(): number {
    return this.option?.cooldownMs ?? 0;
  }

  /** Выдать игроку выбранную способность (вызывается один раз за забег). */
  setAbility(type: AbilityType): void {
    const option = ABILITY_OPTIONS.find((o) => o.ability === type);
    if (!option) return;
    this.option = option;
    this.cooldownMs = 0;
  }

  update(delta: number): void {
    if (this.cooldownMs > 0) {
      this.cooldownMs = Math.max(0, this.cooldownMs - delta);
    }

    // Длительность «Буста» истекла — возвращаем обычные параметры.
    if (this.boostMs > 0) {
      this.boostMs = Math.max(0, this.boostMs - delta);
      if (this.boostMs === 0) this.endBoost();
    }

    // Срабатываем только на новое нажатие кнопки способности, а не на удержание.
    const triggerDown = this.isTriggerDown();
    if (triggerDown && !this.xWasDown) this.tryActivate();
    this.xWasDown = triggerDown;
  }

  private tryActivate(): void {
    if (!this.option || this.cooldownMs > 0) return;
    const used = this.handlers[this.option.ability]();
    if (used) this.cooldownMs = this.option.cooldownMs;
  }

  /** «Пустышка»: убрать все вражеские пули и на время запретить стрельбу. */
  private activateBlank(): boolean {
    this.enemyManager.clearEnemyBullets();
    this.enemyManager.silenceShooting(ABILITY_BLANK_SILENCE_MS);
    return true;
  }

  /** «Аптечка»: восстановить жизнь; при полном запасе кд не тратится. */
  private activateMedkit(): boolean {
    return this.onHeal();
  }

  /** «Буст»: удвоить темп стрельбы и притягивать весь дроп. */
  private activateBoost(): boolean {
    // Повторный «Буст» продлевает действие, а не складывает множители.
    this.boostMs = ABILITY_BOOST_DURATION_MS;
    this.shotSystem.setFireRateMultiplier(ABILITY_BOOST_FIRE_RATE_MULTIPLIER);
    this.itemManager.setAttractAll(true);
    return true;
  }

  private endBoost(): void {
    this.shotSystem.setFireRateMultiplier(1);
    this.itemManager.setAttractAll(false);
  }
}
