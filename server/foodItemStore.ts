import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOODS } from '../config/therapeuticSchema.ts';
import { schemaFoodItemToFoodItem } from '../types-clinical.ts';
import type { FoodItem, FoodApprovalStatus } from '../types-clinical.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PERSIST_PATH = path.resolve(__dirname, '../data/food-items.json');

// ── Persistence format ────────────────────────────────────────────────────

interface StatusOverride {
  approvalStatus: FoodApprovalStatus;
  verifiedBy?: string;
  verifiedAt?: string;
}

interface StoreDelta {
  version: 1;
  exportedAt: string;
  overrides: Record<string, StatusOverride>;
  additions: FoodItem[];
}

// ── Public types ──────────────────────────────────────────────────────────

export interface FoodStoreTotals {
  readonly total: number;
  readonly draft: number;
  readonly pendingReview: number;
  readonly approved: number;
  readonly retired: number;
}

export interface FoodStore {
  getAllFoods(): ReadonlyArray<FoodItem>;
  getApprovedFoods(): ReadonlyArray<FoodItem>;
  getFoodById(id: string): FoodItem | undefined;
  approveFood(id: string, approvedBy: string, credentials: string): FoodItem;
  retireFood(id: string, retiredBy: string): FoodItem;
  addFood(food: FoodItem): void;
  getTotals(): FoodStoreTotals;
}

// ── Disk I/O ──────────────────────────────────────────────────────────────

function loadDelta(persistPath: string): StoreDelta | null {
  if (!fs.existsSync(persistPath)) return null;
  try {
    const raw = fs.readFileSync(persistPath, 'utf8');
    const delta = JSON.parse(raw) as StoreDelta;
    if (delta.version !== 1) return null;
    return delta;
  } catch {
    return null;
  }
}

function saveDelta(persistPath: string, delta: StoreDelta): void {
  const tmp = `${persistPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(delta, null, 2), 'utf8');
  fs.renameSync(tmp, persistPath);
}

// ── Base items from config ────────────────────────────────────────────────

function buildBaseItems(): Map<string, FoodItem> {
  const map = new Map<string, FoodItem>();
  for (const schema of FOODS) {
    const item = schemaFoodItemToFoodItem(schema);
    map.set(item.id, item);
  }
  return map;
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * createFoodStore — creates an isolated food store instance.
 *
 * @param persistPath - path to the JSON delta file; pass null to disable
 *   persistence (useful for test isolation). Defaults to data/food-items.json.
 *
 * All config foods start as 'draft'. Only dietitian approval via approveFood()
 * can transition a food to 'approved'. Automatic approval is prohibited.
 */
export function createFoodStore(persistPath: string | null = DEFAULT_PERSIST_PATH): FoodStore {
  const base = buildBaseItems();
  const overrides: Record<string, StatusOverride> = {};
  const additions: FoodItem[] = [];

  if (persistPath !== null) {
    const delta = loadDelta(persistPath);
    if (delta) {
      Object.assign(overrides, delta.overrides ?? {});
      for (const food of delta.additions ?? []) {
        additions.push(food);
      }
    }
  }

  function applyOverride(item: FoodItem): FoodItem {
    const ov = overrides[item.id];
    if (!ov) return item;
    return { ...item, ...ov };
  }

  function persist(): void {
    if (persistPath === null) return;
    saveDelta(persistPath, {
      version: 1,
      exportedAt: new Date().toISOString(),
      overrides,
      additions,
    });
  }

  const store: FoodStore = {
    getAllFoods(): ReadonlyArray<FoodItem> {
      const out: FoodItem[] = [];
      for (const item of base.values()) {
        out.push(applyOverride(item));
      }
      for (const item of additions) {
        out.push(applyOverride(item));
      }
      return out;
    },

    getApprovedFoods(): ReadonlyArray<FoodItem> {
      return store.getAllFoods().filter((f) => f.approvalStatus === 'approved');
    },

    getFoodById(id: string): FoodItem | undefined {
      const baseItem = base.get(id);
      if (baseItem) return applyOverride(baseItem);
      const added = additions.find((f) => f.id === id);
      if (added) return applyOverride(added);
      return undefined;
    },

    approveFood(id: string, approvedBy: string, credentials: string): FoodItem {
      if (!approvedBy.trim()) {
        throw new Error(`approveFood: approvedBy is required (food "${id}")`);
      }
      if (!credentials.trim()) {
        throw new Error(`approveFood: credentials are required (food "${id}")`);
      }
      if (!store.getFoodById(id)) {
        throw new Error(`approveFood: food "${id}" not found in store`);
      }
      overrides[id] = {
        approvalStatus: 'approved',
        verifiedBy: approvedBy.trim(),
        verifiedAt: new Date().toISOString(),
      };
      persist();
      return store.getFoodById(id)!;
    },

    retireFood(id: string, retiredBy: string): FoodItem {
      if (!retiredBy.trim()) {
        throw new Error(`retireFood: retiredBy is required (food "${id}")`);
      }
      if (!store.getFoodById(id)) {
        throw new Error(`retireFood: food "${id}" not found in store`);
      }
      const existing = overrides[id] ?? {};
      overrides[id] = {
        ...existing,
        approvalStatus: 'retired',
        verifiedBy: retiredBy.trim(),
        verifiedAt: new Date().toISOString(),
      };
      persist();
      return store.getFoodById(id)!;
    },

    addFood(food: FoodItem): void {
      if (base.has(food.id)) {
        throw new Error(`addFood: food "${food.id}" already exists in config — use approveFood() to change its status`);
      }
      const existingIdx = additions.findIndex((f) => f.id === food.id);
      if (existingIdx >= 0) {
        additions[existingIdx] = food;
      } else {
        additions.push(food);
      }
      persist();
    },

    getTotals(): FoodStoreTotals {
      const all = store.getAllFoods();
      return {
        total:         all.length,
        draft:         all.filter((f) => f.approvalStatus === 'draft').length,
        pendingReview: all.filter((f) => f.approvalStatus === 'pending_review').length,
        approved:      all.filter((f) => f.approvalStatus === 'approved').length,
        retired:       all.filter((f) => f.approvalStatus === 'retired').length,
      };
    },
  };

  return store;
}

// ── Singleton ─────────────────────────────────────────────────────────────

let _singleton: FoodStore | null = null;

export function getFoodStore(): FoodStore {
  if (!_singleton) {
    _singleton = createFoodStore();
  }
  return _singleton;
}

export function _resetFoodStoreSingleton(): void {
  _singleton = null;
}
