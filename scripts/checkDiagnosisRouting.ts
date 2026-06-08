import { CLINICAL_PROTOCOLS, PROTOCOL_SLOT_CANDIDATES } from '../config/therapeuticSchema.ts';

// Verify the config data layer for H_PYLORI and RENAL_STAGE_4.
// Type-level routing (DiagnosisType -> DIAGNOSIS_TO_PROTOCOL_CODE -> ProtocolCode)
// is validated by `npm run lint`; enums can't be imported in strip-types mode.

const PROBE_CODES = ['H_PYLORI', 'RENAL_STAGE_4'] as const;

type Result = { label: string; passed: boolean; detail: string };
const results: Result[] = [];

function check(label: string, passed: boolean, detail: string): void {
  results.push({ label, passed, detail });
}

for (const code of PROBE_CODES) {
  const protocol = CLINICAL_PROTOCOLS.find((p) => p.protocol_code === code);
  check(
    `${code} in CLINICAL_PROTOCOLS (active)`,
    protocol !== undefined && protocol.active === true,
    protocol ? `"${protocol.protocol_name}" active=${protocol.active}` : 'not found',
  );

  const candidates = PROTOCOL_SLOT_CANDIDATES.filter((c) => c.protocol_code === code);
  check(
    `${code} slot candidates`,
    candidates.length > 0,
    `${candidates.length} candidate(s)`,
  );
}

let allPassed = true;
for (const r of results) {
  const mark = r.passed ? 'PASS' : 'FAIL';
  console.log(`${mark} ${r.label}: ${r.detail}`);
  if (!r.passed) allPassed = false;
}

if (!allPassed) {
  console.error('\nDiagnosis routing check FAILED; see FAIL lines above.');
  process.exit(1);
} else {
  console.log('\nDiagnosis routing check PASSED.');
}
