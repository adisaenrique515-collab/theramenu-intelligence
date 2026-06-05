import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFoodStore } from '../foodItemStore.ts';
import type { FoodStore } from '../foodItemStore.ts';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeTmpPath(): string {
  return path.join(os.tmpdir(), `theramenu-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function cleanup(p: string): void {
  try { fs.unlinkSync(p); } catch { /* ignore */ }
  try { fs.unlinkSync(`${p}.tmp`); } catch { /* ignore */ }
}

// ── Suite 1: Initial state ────────────────────────────────────────────────

describe('Suite 1 — initial state', () => {
  let store: FoodStore;
  let tmpPath: string;

  before(() => {
    tmpPath = makeTmpPath();
    store = createFoodStore(tmpPath);
  });

  after(() => cleanup(tmpPath));

  it('loads all config foods on fresh store', () => {
    const all = store.getAllFoods();
    // ~396 foods from FOODS config; allow for config growth
    assert.ok(all.length >= 100, `Expected at least 100 foods, got ${all.length}`);
  });

  it('all config foods start as draft', () => {
    const all = store.getAllFoods();
    const nonDraft = all.filter((f) => f.approvalStatus !== 'draft');
    assert.equal(nonDraft.length, 0, `Expected 0 non-draft foods, got ${nonDraft.length}`);
  });

  it('getApprovedFoods returns empty array on fresh store', () => {
    assert.equal(store.getApprovedFoods().length, 0);
  });

  it('getTotals reflects all-draft state', () => {
    const totals = store.getTotals();
    assert.equal(totals.approved, 0);
    assert.equal(totals.retired, 0);
    assert.equal(totals.pendingReview, 0);
    assert.ok(totals.draft >= 100);
    assert.equal(totals.total, totals.draft);
  });
});

// ── Suite 2: getFoodById ──────────────────────────────────────────────────

describe('Suite 2 — getFoodById', () => {
  let store: FoodStore;
  let tmpPath: string;
  let firstId: string;

  before(() => {
    tmpPath = makeTmpPath();
    store = createFoodStore(tmpPath);
    firstId = store.getAllFoods()[0].id;
  });

  after(() => cleanup(tmpPath));

  it('returns a food for a known id', () => {
    const food = store.getFoodById(firstId);
    assert.ok(food !== undefined);
    assert.equal(food.id, firstId);
  });

  it('returns undefined for an unknown id', () => {
    assert.equal(store.getFoodById('__nonexistent__'), undefined);
  });
});

// ── Suite 3: approveFood ──────────────────────────────────────────────────

describe('Suite 3 — approveFood', () => {
  let store: FoodStore;
  let tmpPath: string;
  let targetId: string;

  before(() => {
    tmpPath = makeTmpPath();
    store = createFoodStore(tmpPath);
    targetId = store.getAllFoods()[0].id;
  });

  after(() => cleanup(tmpPath));

  it('transitions status to approved', () => {
    const approved = store.approveFood(targetId, 'Dr. Jane Smith', 'RD, CDE');
    assert.equal(approved.approvalStatus, 'approved');
  });

  it('sets verifiedBy on approved food', () => {
    const food = store.getFoodById(targetId);
    assert.equal(food?.verifiedBy, 'Dr. Jane Smith');
  });

  it('sets verifiedAt on approved food', () => {
    const food = store.getFoodById(targetId);
    assert.ok(food?.verifiedAt, 'verifiedAt should be set');
  });

  it('approved food appears in getApprovedFoods', () => {
    const approved = store.getApprovedFoods();
    assert.ok(approved.some((f) => f.id === targetId));
  });

  it('throws if approvedBy is empty string', () => {
    const otherId = store.getAllFoods()[1].id;
    assert.throws(
      () => store.approveFood(otherId, '', 'RD'),
      /approvedBy is required/,
    );
  });

  it('throws if approvedBy is whitespace only', () => {
    const otherId = store.getAllFoods()[2].id;
    assert.throws(
      () => store.approveFood(otherId, '   ', 'RD'),
      /approvedBy is required/,
    );
  });

  it('throws if credentials are empty', () => {
    const otherId = store.getAllFoods()[3].id;
    assert.throws(
      () => store.approveFood(otherId, 'Dr. Smith', ''),
      /credentials are required/,
    );
  });

  it('throws if food id does not exist', () => {
    assert.throws(
      () => store.approveFood('__not_found__', 'Dr. Smith', 'RD'),
      /not found in store/,
    );
  });
});

// ── Suite 4: retireFood ───────────────────────────────────────────────────

describe('Suite 4 — retireFood', () => {
  let store: FoodStore;
  let tmpPath: string;
  let targetId: string;

  before(() => {
    tmpPath = makeTmpPath();
    store = createFoodStore(tmpPath);
    targetId = store.getAllFoods()[4].id;
    // First approve, then retire to test the transition
    store.approveFood(targetId, 'Dr. A', 'RD');
  });

  after(() => cleanup(tmpPath));

  it('transitions an approved food to retired', () => {
    const retired = store.retireFood(targetId, 'Dr. B');
    assert.equal(retired.approvalStatus, 'retired');
  });

  it('retired food does not appear in getApprovedFoods', () => {
    const approved = store.getApprovedFoods();
    assert.ok(!approved.some((f) => f.id === targetId));
  });

  it('throws if retiredBy is empty', () => {
    const otherId = store.getAllFoods()[5].id;
    assert.throws(
      () => store.retireFood(otherId, ''),
      /retiredBy is required/,
    );
  });

  it('throws if food id does not exist', () => {
    assert.throws(
      () => store.retireFood('__not_found__', 'Dr. X'),
      /not found in store/,
    );
  });
});

// ── Suite 5: persistence round-trip ──────────────────────────────────────

describe('Suite 5 — persistence round-trip', () => {
  let tmpPath: string;
  let approvedId: string;
  let retiredId: string;

  before(() => {
    tmpPath = makeTmpPath();
    const store = createFoodStore(tmpPath);
    const foods = store.getAllFoods();
    approvedId = foods[0].id;
    retiredId  = foods[1].id;
    store.approveFood(approvedId, 'Dr. Persist', 'RD');
    store.retireFood(retiredId, 'Dr. Persist');
  });

  after(() => cleanup(tmpPath));

  it('delta file is written to disk', () => {
    assert.ok(fs.existsSync(tmpPath), 'persist file should exist after mutations');
  });

  it('re-created store reads approved status from disk', () => {
    const store2 = createFoodStore(tmpPath);
    const food = store2.getFoodById(approvedId);
    assert.equal(food?.approvalStatus, 'approved');
  });

  it('re-created store reads retired status from disk', () => {
    const store2 = createFoodStore(tmpPath);
    const food = store2.getFoodById(retiredId);
    assert.equal(food?.approvalStatus, 'retired');
  });

  it('re-created store has correct totals', () => {
    const store2 = createFoodStore(tmpPath);
    const t = store2.getTotals();
    assert.equal(t.approved, 1);
    assert.equal(t.retired, 1);
    assert.equal(t.approved + t.retired + t.draft + t.pendingReview, t.total);
  });

  it('re-created store has verifiedBy preserved', () => {
    const store2 = createFoodStore(tmpPath);
    const food = store2.getFoodById(approvedId);
    assert.equal(food?.verifiedBy, 'Dr. Persist');
  });
});

// ── Suite 6: no-persist mode (null path) ─────────────────────────────────

describe('Suite 6 — null persist path (in-memory)', () => {
  it('does not write to disk', () => {
    const store = createFoodStore(null);
    const id = store.getAllFoods()[0].id;
    store.approveFood(id, 'Dr. Mem', 'RD');
    assert.equal(store.getApprovedFoods().length, 1);
    // No file was written — no path to check, just verify no exception thrown
  });

  it('mutations are not visible to a separate in-memory store', () => {
    const store1 = createFoodStore(null);
    const store2 = createFoodStore(null);
    const id = store1.getAllFoods()[0].id;
    store1.approveFood(id, 'Dr. X', 'RD');
    // store2 is independent
    assert.equal(store2.getApprovedFoods().length, 0);
  });
});

// ── Suite 7: addFood ──────────────────────────────────────────────────────

describe('Suite 7 — addFood', () => {
  let store: FoodStore;

  before(() => {
    store = createFoodStore(null);
  });

  it('adds a new food item not in config', () => {
    const newFood = {
      ...store.getAllFoods()[0],
      id: '__test_new_food_xyz__',
      canonicalName: 'Test Import Food',
      approvalStatus: 'pending_review' as const,
    };
    store.addFood(newFood);
    const found = store.getFoodById('__test_new_food_xyz__');
    assert.ok(found !== undefined);
    assert.equal(found.canonicalName, 'Test Import Food');
  });

  it('added food appears in getAllFoods', () => {
    const all = store.getAllFoods();
    assert.ok(all.some((f) => f.id === '__test_new_food_xyz__'));
  });

  it('throws if food id already exists in config', () => {
    const existing = store.getAllFoods()[0];
    assert.throws(
      () => store.addFood(existing),
      /already exists in config/,
    );
  });

  it('added food can be approved', () => {
    const approved = store.approveFood('__test_new_food_xyz__', 'Dr. New', 'RD');
    assert.equal(approved.approvalStatus, 'approved');
  });
});

// ── Suite 8: getTotals arithmetic ─────────────────────────────────────────

describe('Suite 8 — getTotals arithmetic', () => {
  it('total equals sum of all status buckets', () => {
    const store = createFoodStore(null);
    const foods = store.getAllFoods();
    store.approveFood(foods[0].id, 'Dr. A', 'RD');
    store.retireFood(foods[1].id, 'Dr. B');
    const t = store.getTotals();
    assert.equal(t.total, t.draft + t.pendingReview + t.approved + t.retired);
  });
});
