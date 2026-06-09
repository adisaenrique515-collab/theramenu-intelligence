import { BookOpen, Info, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { FOODS } from '../config/therapeuticSchema';
import { getProtocolConfig } from '../services/protocolAdapter';
import { DIAGNOSIS_TO_PROTOCOL_CODE } from '../types';
import type { DiagnosisType, ProtocolConfig, SchemaFoodItem, SchemaMealType, SchemaTextureClass } from '../types';
import { Badge, Card } from './thera/ui';

const MEAL_FAMILIES: { label: string; types: SchemaMealType[] }[] = [
  { label: 'Breakfast', types: ['breakfast'] },
  { label: 'Lunch', types: ['lunch'] },
  { label: 'Dinner', types: ['dinner'] },
  { label: 'Snacks', types: ['snack_am', 'snack_pm', 'snack_eve'] },
];

const foodById = new Map(FOODS.map((food) => [food.food_id, food]));

function loadProtocol(diagnosis?: DiagnosisType | ''): { config: ProtocolConfig | null; code?: string } {
  if (!diagnosis) return { config: null };
  const code = DIAGNOSIS_TO_PROTOCOL_CODE[diagnosis];
  if (!code) return { config: null };

  try {
    return { config: getProtocolConfig(code), code };
  } catch {
    return { config: null, code };
  }
}

function formatMealType(type: SchemaMealType): string {
  return type.replace('snack_', 'snack ').replace('_', ' ');
}

function formatSlotName(slotName: string): string {
  return slotName.replaceAll('_', ' ');
}

function candidateFoods(
  config: ProtocolConfig,
  mealType: SchemaMealType,
  slotName: string,
  textureLevel: SchemaTextureClass,
): SchemaFoodItem[] {
  const seen = new Set<string>();
  return config.candidates
    .filter((candidate) => candidate.meal_type === mealType && candidate.slot_name === slotName)
    .map((candidate) => foodById.get(candidate.food_id))
    .filter((food): food is SchemaFoodItem => !!food)
    .filter((food) => food.texture_tags.includes(textureLevel))
    .filter((food) => {
      if (seen.has(food.food_id)) return false;
      seen.add(food.food_id);
      return true;
    })
    .slice(0, 4);
}

export function ProtocolCandidatePreview({
  diagnosis,
  textureLevel,
  mealCount,
}: {
  diagnosis?: DiagnosisType | '';
  textureLevel: SchemaTextureClass;
  mealCount: number;
}) {
  const { config, code } = useMemo(() => loadProtocol(diagnosis), [diagnosis]);
  const preferRules = config?.foodRules.filter((rule) => rule.rule_type === 'prefer').slice(0, 3) ?? [];
  const avoidRules = config?.foodRules.filter((rule) => rule.rule_type === 'avoid').slice(0, 3) ?? [];

  if (!diagnosis) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-900">Protocol candidate preview</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Select a diagnosis to preview the current TheraMenu protocol, meal slot families, and eligible candidate
              examples.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-950">No protocol preview available</p>
            <p className="mt-1 text-xs leading-5 text-amber-900">
              {code
                ? `Diagnosis maps to ${code}, but the protocol could not be loaded for preview.`
                : 'This diagnosis does not currently map to an active protocol preview.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-blue-700">
            Protocol candidate preview
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{config.protocol.protocol_name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Candidate examples come from the current schema. Final selection still depends on texture matching,
            protocol-specific filters, scoring, and anti-repetition.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{config.protocol.protocol_code}</Badge>
          <Badge tone="blue">{config.protocol.family}</Badge>
          <Badge tone="slate">{mealCount}/day</Badge>
        </div>
      </div>

      <dl className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Selected diagnosis</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{diagnosis}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Selected texture</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{textureLevel}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Protocol default</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {config.protocol.default_texture}, {config.protocol.default_meal_count}/day
          </dd>
        </div>
      </dl>

      <div className="grid gap-3 xl:grid-cols-2">
        {MEAL_FAMILIES.map((family) => {
          const slots = config.slots
            .filter((slot) => family.types.includes(slot.meal_type))
            .sort((a, b) => a.meal_type.localeCompare(b.meal_type) || a.slot_order - b.slot_order);

          return (
            <div key={family.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{family.label}</p>
                <Badge tone="slate">{slots.length} slots</Badge>
              </div>
              <div className="space-y-3">
                {slots.map((slot) => {
                  const foods = candidateFoods(config, slot.meal_type, slot.slot_name, textureLevel);
                  return (
                    <div key={`${slot.meal_type}-${slot.slot_name}`} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500">
                          {formatMealType(slot.meal_type)} / {formatSlotName(slot.slot_name)}
                        </span>
                        {!slot.required && <Badge tone="amber">optional</Badge>}
                      </div>
                      {foods.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {foods.map((food) => (
                            <span
                              key={food.food_id}
                              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                              title={`${food.category}; ${food.clinical_tags.join(', ')}`}
                            >
                              {food.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs leading-5 text-slate-500">
                          No texture-compatible example candidates found for this slot preview.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {(preferRules.length > 0 || avoidRules.length > 0 || config.serviceRules.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Prefer
            </p>
            <ul className="space-y-1 text-xs leading-5 text-emerald-900">
              {preferRules.map((rule) => <li key={rule.food_tag}>{rule.note}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-amber-950">Restrictions</p>
            <ul className="space-y-1 text-xs leading-5 text-amber-900">
              {avoidRules.map((rule) => <li key={rule.food_tag}>{rule.note}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-900">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Service notes
            </p>
            <ul className="space-y-1 text-xs leading-5 text-slate-600">
              {config.serviceRules.slice(0, 3).map((rule) => <li key={rule.rule_name}>{rule.note}</li>)}
              {config.serviceRules.length === 0 && <li>No extra service notes configured.</li>}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
