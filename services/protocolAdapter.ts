// ─────────────────────────────────────────────────────────────────────────────
// services/protocolAdapter.ts  — NEW FILE
// Location: services/protocolAdapter.ts
//
// Single responsibility: expose getProtocolConfig(protocolCode).
// Reads from the static therapeutic schema (config/therapeuticSchema.ts).
// Called by clinicalDatabase.ts → getSchemaEnrichedCondition().
// NEVER called by claudeService.ts or validationService.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProtocolCode,
  ProtocolConfig,
} from '../types';
import {
  CLINICAL_PROTOCOLS,
  PROTOCOL_RULE_TARGETS,
  PROTOCOL_FOOD_RULES,
  PROTOCOL_COMPONENT_SLOTS,
  PROTOCOL_SLOT_CANDIDATES,
  PROTOCOL_SERVICE_RULES,
} from '../config/therapeuticSchema';

export class ProtocolNotFoundError extends Error {
  constructor(code: string) {
    super(`Protocol '${code}' not found in the clinical registry.`);
    this.name = "ProtocolNotFoundError";
  }
}

export class ProtocolInactiveError extends Error {
  constructor(code: string) {
    super(`Protocol '${code}' is inactive. Cannot generate a plan.`);
    this.name = "ProtocolInactiveError";
  }
}

/**
 * Returns the complete ProtocolConfig for a given ProtocolCode.
 * Throws typed errors on lookup failure — never returns undefined silently.
 */
export function getProtocolConfig(protocolCode: ProtocolCode): ProtocolConfig {
  const protocol = CLINICAL_PROTOCOLS.find(p => p.protocol_code === protocolCode);
  if (!protocol) throw new ProtocolNotFoundError(protocolCode);
  if (!protocol.active) throw new ProtocolInactiveError(protocolCode);

  const targets = PROTOCOL_RULE_TARGETS.find(t => t.protocol_code === protocolCode);
  if (!targets) throw new Error(`No nutrient targets for protocol '${protocolCode}'.`);

  const foodRules   = PROTOCOL_FOOD_RULES.filter(r => r.protocol_code === protocolCode);
  const slots       = PROTOCOL_COMPONENT_SLOTS.filter(s => s.protocol_code === protocolCode);
  const candidates  = PROTOCOL_SLOT_CANDIDATES
    .filter(c => c.protocol_code === protocolCode)
    .sort((a, b) => b.priority - a.priority);
  const serviceRules = PROTOCOL_SERVICE_RULES.filter(r => r.protocol_code === protocolCode);

  return { protocol, targets, foodRules, slots, candidates, serviceRules };
}

/** Returns all active ProtocolCodes. Used by UI selects if needed. */
export function getActiveProtocolCodes(): ProtocolCode[] {
  return CLINICAL_PROTOCOLS.filter(p => p.active).map(p => p.protocol_code);
}

/** Returns the value of a named service rule, or null if not defined. */
export function getServiceRuleValue(protocolCode: ProtocolCode, ruleName: string): string | null {
  const rule = PROTOCOL_SERVICE_RULES.find(
    r => r.protocol_code === protocolCode && r.rule_name === ruleName
  );
  return rule?.rule_value ?? null;
}
