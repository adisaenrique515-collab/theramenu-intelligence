
import React from 'react';
import type { OfflineClinicalOverview } from '../offlineClinical.types';
import type { LocalNutritionDbStatus } from '../localNutritionDb.types';
import { loadResourcePackSummary } from '../services/resourcePack';
import { loadOfflineClinicalOverview } from '../services/offlineClinicalApi';
import { loadLocalNutritionDbStatus } from '../services/localClinicalApi';
import type { ResourceFoodInsight, ResourcePackSummary } from '../resourcePack.types';

type BlueprintNodeId =
  | 'nutritional-therapy'
  | 'mnt'
  | 'dietitian-referral'
  | 'individualised-plans'
  | 'nutrient-dense-focus'
  | 'hospital-diet-classifications'
  | 'dietary-components'
  | 'management-education'
  | 'physical-activity'
  | 'psychosocial-lifestyle'
  | 'fasting-considerations';

interface BlueprintNode {
  id: BlueprintNodeId;
  title: string;
  level: 1 | 2 | 3;
  parentId?: BlueprintNodeId;
  badge: string;
  summary: string;
  status: 'live' | 'partial' | 'planned';
  sources: string[];
  implementationFocus: string[];
  evidenceKey: 'overview' | 'nutrientDenseFoods' | 'renalAwareFoods' | 'lowSodiumFoods' | 'workflow';
}

const BLUEPRINT_NODES: BlueprintNode[] = [
  {
    id: 'nutritional-therapy',
    title: 'Nutritional Therapy & Diets',
    level: 1,
    badge: 'Core Domain',
    summary: 'Primary clinical engine domain covering diet prescription, therapeutic menus, and nutrient-aware food selection.',
    status: 'live',
    sources: ['Clinical blueprint map', 'AUSNUT 2023 resource pack', 'ESPEN hospital workflow seed'],
    implementationFocus: ['Protocol generator', 'Resource-backed nutrient inventory', 'Diagnosis-specific meal construction'],
    evidenceKey: 'overview',
  },
  {
    id: 'mnt',
    title: 'Medical Nutrition Therapy (MNT)',
    level: 2,
    parentId: 'nutritional-therapy',
    badge: 'High Priority',
    summary: 'Wraps clinician-guided nutrition planning around diagnosis, risk, texture, and meal frequency inputs.',
    status: 'live',
    sources: ['ESPEN guideline on hospital nutrition', 'Therapeutic form workflow'],
    implementationFocus: ['Admission screening context', 'Diagnosis-to-protocol mapping', 'Patient-specific plan generation'],
    evidenceKey: 'workflow',
  },
  {
    id: 'dietitian-referral',
    title: 'Registered Dietitian Referral',
    level: 3,
    parentId: 'mnt',
    badge: 'Workflow',
    summary: 'Flags when medical nutrition support or specialist dietetic review should be triggered rather than relying on menu generation alone.',
    status: 'partial',
    sources: ['ESPEN guideline on hospital nutrition'],
    implementationFocus: ['Escalation prompts', 'High-risk handoff logic', 'Clinical sign-off hooks'],
    evidenceKey: 'workflow',
  },
  {
    id: 'individualised-plans',
    title: 'Individualised Eating Plans',
    level: 3,
    parentId: 'mnt',
    badge: 'Live',
    summary: 'Patient age, sex, weight, texture, diagnosis, and meal-count inputs already shape the weekly output plan.',
    status: 'live',
    sources: ['Clinical intake module', 'Schema-driven weekly generator'],
    implementationFocus: ['Patient biometrics', 'Diagnosis targeting', 'Meal-count and texture customization'],
    evidenceKey: 'overview',
  },
  {
    id: 'nutrient-dense-focus',
    title: 'Nutrient-Dense Food Focus',
    level: 3,
    parentId: 'mnt',
    badge: 'AUSNUT',
    summary: 'Uses the uploaded AUSNUT food corpus to identify dense, lower-risk candidates for clinical menus and education.',
    status: 'live',
    sources: ['AUSNUT 2023 food nutrient profiles', 'AUSNUT 2023 food details'],
    implementationFocus: ['Nutrient density shortlist', 'Clinical candidate discovery', 'Evidence-backed food panels'],
    evidenceKey: 'nutrientDenseFoods',
  },
  {
    id: 'hospital-diet-classifications',
    title: 'Hospital Diet Classifications',
    level: 2,
    parentId: 'nutritional-therapy',
    badge: 'Live',
    summary: 'Groups therapeutic menu logic into standard hospital, cardiac, diabetic, renal, gastric, and hepatic treatment families.',
    status: 'live',
    sources: ['Therapeutic schema', 'ESPEN standard diet logic', 'KDIGO CKD seed'],
    implementationFocus: ['Default diet baseline', 'Therapeutic diet justification', 'Kidney admission override awareness'],
    evidenceKey: 'workflow',
  },
  {
    id: 'dietary-components',
    title: 'Dietary Components',
    level: 2,
    parentId: 'nutritional-therapy',
    badge: 'AUSNUT',
    summary: 'Surfaces the nutrient variables and food-group inventory the rule engine can reason over from the uploaded spreadsheets.',
    status: 'live',
    sources: ['AUSNUT nutrient dictionary', 'AUSNUT food measures', 'AUSNUT recipe composition'],
    implementationFocus: ['Food groups', 'Portion measures', 'Tracked nutrients'],
    evidenceKey: 'overview',
  },
  {
    id: 'management-education',
    title: 'Management & Education',
    level: 1,
    badge: 'Workflow',
    summary: 'Operational care layer for admission screening, reassessment cadence, education prompts, and escalation to nutrition support.',
    status: 'partial',
    sources: ['ESPEN guideline on hospital nutrition'],
    implementationFocus: ['Screen at admission', 'Reassess every 3-5 days', 'Escalate if diet alone is insufficient'],
    evidenceKey: 'workflow',
  },
  {
    id: 'physical-activity',
    title: 'Physical Activity',
    level: 1,
    badge: 'Planned',
    summary: 'Blueprint branch reserved for activity-linked care advice; no dedicated uploaded exercise guideline has been integrated yet.',
    status: 'planned',
    sources: ['Clinical blueprint map'],
    implementationFocus: ['Future mobility protocol layer', 'Recovery support prompts'],
    evidenceKey: 'overview',
  },
  {
    id: 'psychosocial-lifestyle',
    title: 'Psychosocial & Lifestyle Care',
    level: 1,
    badge: 'Planned',
    summary: 'Needs clinician-authored behavioral, social, and adherence content before it should influence therapeutic recommendations.',
    status: 'planned',
    sources: ['Clinical blueprint map'],
    implementationFocus: ['Adherence barriers', 'Lifestyle coaching', 'Supportive care referrals'],
    evidenceKey: 'overview',
  },
  {
    id: 'fasting-considerations',
    title: 'Fasting Considerations',
    level: 1,
    badge: 'Partial',
    summary: 'Can be informed by diagnosis risk and monitored nutrients, but the app still needs a dedicated fasting ruleset before this branch is clinically complete.',
    status: 'partial',
    sources: ['KDIGO CKD guideline seed', 'Clinical blueprint map'],
    implementationFocus: ['Risk prompts', 'Hydration monitoring', 'Diagnosis-based exception handling'],
    evidenceKey: 'renalAwareFoods',
  },
];

const STATUS_STYLES: Record<BlueprintNode['status'], string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  planned: 'border-slate-200 bg-slate-100 text-slate-600',
};

const currencyValue = (value: number) => Math.round(value * 10) / 10;

const renderFoodInsight = (food: ResourceFoodInsight) => (
  <div key={food.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{food.name}</h4>
        <p className="mt-1 text-[11px] font-mono uppercase tracking-widest text-slate-400">{food.group}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
        AUSNUT
      </span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Protein</p>
        <p className="mt-1 text-lg font-black text-slate-900">{currencyValue(food.proteinG)}g</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fibre</p>
        <p className="mt-1 text-lg font-black text-slate-900">{currencyValue(food.fibreG)}g</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sodium</p>
        <p className="mt-1 text-lg font-black text-slate-900">{currencyValue(food.sodiumMg)}mg</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Potassium</p>
        <p className="mt-1 text-lg font-black text-slate-900">{currencyValue(food.potassiumMg)}mg</p>
      </div>
    </div>
  </div>
);

const DiagnosisDB: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = React.useState<BlueprintNodeId>('nutritional-therapy');
  const [resourceSummary, setResourceSummary] = React.useState<ResourcePackSummary | null>(null);
  const [offlineOverview, setOfflineOverview] = React.useState<OfflineClinicalOverview | null>(null);
  const [dbStatus, setDbStatus] = React.useState<LocalNutritionDbStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([loadResourcePackSummary(), loadOfflineClinicalOverview(), loadLocalNutritionDbStatus()])
      .then(([summary, overview, nutritionDbStatus]) => {
        if (!cancelled) {
          setResourceSummary(summary);
          setOfflineOverview(overview);
          setDbStatus(nutritionDbStatus);
          setLoading(false);
        }
      })
      .catch((resourceError) => {
        if (!cancelled) {
          setError(resourceError instanceof Error ? resourceError.message : 'Failed to load clinical resources.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNode = BLUEPRINT_NODES.find((node) => node.id === selectedNodeId) ?? BLUEPRINT_NODES[0];

  const evidencePanel = (() => {
    if (!resourceSummary) {
      return null;
    }

    if (selectedNode.evidenceKey === 'nutrientDenseFoods') {
      return resourceSummary.nutrientDenseFoods.map(renderFoodInsight);
    }

    if (selectedNode.evidenceKey === 'renalAwareFoods') {
      return resourceSummary.renalAwareFoods.map(renderFoodInsight);
    }

    if (selectedNode.evidenceKey === 'lowSodiumFoods') {
      return resourceSummary.lowSodiumFoods.map(renderFoodInsight);
    }

    if (selectedNode.evidenceKey === 'workflow') {
      const screening = resourceSummary.espenSeed.rules.screening?.summary;
      const reassessment = resourceSummary.espenSeed.rules.reassessment?.summary;
      const therapeuticDietUse = resourceSummary.espenSeed.rules.therapeuticDietUse?.summary;
      const renalProtein = resourceSummary.kdigoSeed.rules.proteinIntake?.targetGPerKgPerDay;
      const sodiumG = resourceSummary.kdigoSeed.rules.sodiumIntake?.maxSodiumGPerDay;

      return [
        screening,
        reassessment,
        therapeuticDietUse,
        renalProtein ? `KDIGO protein target: ${renalProtein} g/kg/day for adults with CKD G3-G5.` : null,
        sodiumG ? `KDIGO sodium ceiling: ${sodiumG} g/day.` : null,
      ]
        .filter(Boolean)
        .map((item, index) => (
          <div key={`${selectedNode.id}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm leading-relaxed text-slate-700">{item}</p>
          </div>
        ));
    }

    return [
      <div key="inventory" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Resource Inventory</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.foodsCount.toLocaleString()}</p>
            <p className="text-xs text-slate-500">AUSNUT food records</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.nutrientDefinitions}</p>
            <p className="text-xs text-slate-500">tracked nutrients</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.foodsWithMeasures.toLocaleString()}</p>
            <p className="text-xs text-slate-500">foods with measures</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.foodsWithRecipes.toLocaleString()}</p>
            <p className="text-xs text-slate-500">foods with recipe breakdowns</p>
          </div>
        </div>
      </div>,
      <div key="groups" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Top Food Groups</p>
        <div className="mt-4 space-y-3">
          {resourceSummary.topFoodGroups.map((group) => (
            <div key={group.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">{group.name}</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{group.count}</span>
            </div>
          ))}
        </div>
      </div>,
      <div key="branded" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Branded Label Intelligence</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.brandedSeed.dataset.products.toLocaleString()}</p>
            <p className="text-xs text-slate-500">BFPD branded products</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{resourceSummary.brandedSeed.dataset.productsWithPhosphateAdditives.toLocaleString()}</p>
            <p className="text-xs text-slate-500">with phosphate terms</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Label Watchlist</p>
            <p className="mt-2 text-sm text-slate-700">{resourceSummary.brandedSeed.ingredientLabelWarnings.join(', ')}</p>
          </div>
          {resourceSummary.brandedSeed.phosphateAdditiveExamples.slice(0, 2).map((item) => (
            <div key={item.ndbNo} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">{item.manufacturer}</p>
              <p className="mt-2 text-xs text-slate-600">
                {item.serving} • Na {currencyValue(item.sodiumMg)}mg • P {currencyValue(item.phosphorusMg)}mg
              </p>
            </div>
          ))}
        </div>
      </div>,
    ];
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(135deg,#0f172a,#172554_52%,#020617)] p-8 text-white shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-200">Clinical Blueprint Explorer</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Turn the mind map into a working clinical product surface.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
              This tab now maps your blueprint branches to live app capabilities, uploaded guideline seeds, the AUSNUT dataset, and the offline clinical engine concepts shown in the video so the build can progress from abstract architecture into a resilient product surface.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:min-w-[320px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Guideline Seeds</p>
              <p className="mt-2 text-3xl font-black">3</p>
              <p className="mt-1 text-xs text-slate-300">KDIGO + ESPEN + low phosphorus integrated</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Network Status</p>
              <p className="mt-2 text-3xl font-black">{offlineOverview?.networkStatus ?? '...'}</p>
              <p className="mt-1 text-xs text-slate-300">Offline-first internal API mode</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl">
          {BLUEPRINT_NODES.map((node) => {
            const isActive = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                  isActive ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                } ${node.level === 2 ? 'ml-4 w-[calc(100%-1rem)]' : ''} ${node.level === 3 ? 'ml-8 w-[calc(100%-2rem)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{node.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{node.summary}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${STATUS_STYLES[node.status]}`}>
                    {node.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400">
                  {selectedNode.parentId ? `Blueprint Path / ${selectedNode.parentId}` : 'Blueprint Root'}
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{selectedNode.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{selectedNode.summary}</p>
              </div>
              <span className={`h-fit rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] ${STATUS_STYLES[selectedNode.status]}`}>
                {selectedNode.status}
              </span>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {selectedNode.implementationFocus.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Implementation Focus</p>
                  <p className="mt-3 text-sm font-semibold text-slate-800">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Evidence Sources</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedNode.sources.map((source) => (
                  <span key={source} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {loading && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-xl">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
              <p className="mt-4 text-sm font-semibold text-slate-700">Loading AUSNUT and guideline resources...</p>
            </div>
          )}

          {error && (
            <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-xl">
              Resource load failed: {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {evidencePanel}
              </div>

              {offlineOverview && (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400">Offline Clinical Engine</p>
                      <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Internal API concepts absorbed from the video.</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        The app now models the video’s architecture directly: disconnected operation, local clinical modules, structured source tables, normalization, diagnosis routing, and care-path stratification.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Mode</p>
                        <p className="mt-1 text-sm font-bold text-emerald-900">{offlineOverview.engineMode}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Routes</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{offlineOverview.diagnosisRoutes.length} active</p>
                      </div>
                      {dbStatus && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">SQLite</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{dbStatus.databaseReady ? 'Loaded' : 'Schema Ready'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Module Status</p>
                      <div className="mt-4 space-y-3">
                        {offlineOverview.modules.map((module) => (
                          <div key={module.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-slate-900">{module.name}</p>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                                module.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {module.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-slate-600">{module.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Source Tables</p>
                      <div className="mt-4 space-y-3">
                        {offlineOverview.dataSources.map((source) => (
                          <div key={source.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-slate-900">{source.id}</p>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
                                {source.role}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-slate-600">{source.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {source.fields.map((field) => (
                                <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Data Normalization</p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Raw Inputs</p>
                          <div className="mt-3 space-y-2">
                            {offlineOverview.normalizationExample.rawInputs.map((input) => (
                              <p key={input} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                {input}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
                          <table className="min-w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="pb-3 pr-4">Meal</th>
                                <th className="pb-3 pr-4">Calories</th>
                                <th className="pb-3 pr-4">Protein</th>
                                <th className="pb-3 pr-4">Carbs</th>
                                <th className="pb-3">Fat</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                              {offlineOverview.normalizationExample.normalizedRows.map((row) => (
                                <tr key={row.meal}>
                                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.meal}</td>
                                  <td className="py-3 pr-4">{row.calories}</td>
                                  <td className="py-3 pr-4">{row.proteinG}g</td>
                                  <td className="py-3 pr-4">{row.carbsG}g</td>
                                  <td className="py-3">{row.fatG}g</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Care Paths</p>
                        <div className="mt-4 space-y-3">
                          {offlineOverview.carePaths.map((carePath) => (
                            <div key={carePath.code} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-bold text-slate-900">{carePath.label}</p>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600">{carePath.indication}</p>
                              <p className="mt-3 text-xs font-semibold text-slate-700">
                                {carePath.energyKcalPerKg} kcal/kg, protein {carePath.proteinGPerKgMin}-{carePath.proteinGPerKgMax} g/kg
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Query Guardrails</p>
                        <div className="mt-4 space-y-3">
                          {offlineOverview.queryGuardrails.map((guardrail) => (
                            <div key={guardrail.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-bold text-slate-900">{guardrail.label}</p>
                              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-300">{guardrail.expression}</pre>
                            </div>
                          ))}
                        </div>
                      </div>

                      {offlineOverview.phosphorusGuide && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Low-Phosphorus Guide</p>
                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-bold text-slate-900">
                                Daily target {offlineOverview.phosphorusGuide.dailyAllowanceMg.min}-{offlineOverview.phosphorusGuide.dailyAllowanceMg.max} mg
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                Label watchlist: {offlineOverview.phosphorusGuide.ingredientLabelWarnings.join(', ')}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Prefer</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {offlineOverview.phosphorusGuide.lowerPhosphorusFoodGroups.slice(0, 6).map((item) => (
                                  <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Care Notes</p>
                              <div className="mt-3 space-y-2">
                                {offlineOverview.phosphorusGuide.careNotes.map((note) => (
                                  <p key={note} className="text-xs leading-relaxed text-slate-600">{note}</p>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {dbStatus && (
                    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Localized Relational Database</p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-bold text-slate-900">Database Path</p>
                          <p className="mt-2 break-all text-xs text-slate-600">{dbStatus.databasePath}</p>
                          <p className="mt-3 text-xs text-slate-500">Source mode: {dbStatus.dataSource} / {dbStatus.phiProcessing}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-bold text-slate-900">Row Counts</p>
                          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-lg font-black text-slate-900">{dbStatus.rowCounts.foodDescription.toLocaleString()}</p>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Food</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-lg font-black text-slate-900">{dbStatus.rowCounts.nutrientData.toLocaleString()}</p>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Nutrients</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-lg font-black text-slate-900">{dbStatus.rowCounts.weightsAndMeasures.toLocaleString()}</p>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Weights</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {dbStatus.requiredFiles.map((file) => (
                          <div key={file.name} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-bold text-slate-900">{file.name}</p>
                            <p className={`mt-1 text-[10px] uppercase tracking-[0.2em] ${file.found ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {file.found ? 'Found' : 'Missing'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default DiagnosisDB;
