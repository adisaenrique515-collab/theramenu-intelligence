import React, { useEffect, useMemo, useState } from 'react';

interface Rule { id: string; type: string; subject: string; path: string; operator: string; value: any; severity: string; message: string; suggestion?: string }
interface Protocol { id: string; name: string; category: string; triggers: string[]; rules: Rule[]; instructions?: string[] }
interface Dataset { version?: string; updated?: string; protocols: Protocol[] }

const fetchJSON = async (url: string) => (await fetch(url)).json();
const uid = () => Math.random().toString(36).slice(2, 8);
const categories = ['Allergy','Disease','Texture','Metabolic','Electrolyte','Other'];

const ProtocolsAdmin: React.FC = () => {
  const [data, setData] = useState<Dataset | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load dataset (prefer local draft), honor ?protocol=ID for selection
  useEffect(() => { (async () => {
    try {
      const server = await fetchJSON('/protocols/clinical_protocols.json');
      const localRaw = localStorage.getItem('protocols_draft');
      let d: Dataset = server;
      if (localRaw) { try { const dj = JSON.parse(localRaw); if (dj?.protocols) d = dj; } catch {} }
      setData(d);
      const usp = new URLSearchParams(window.location.search);
      const pid = usp.get('protocol');
      if (pid && d?.protocols?.some(x => x.id === pid)) setSelectedId(pid);
      else if (d?.protocols?.length) setSelectedId(d.protocols[0].id);
    } catch (e) { console.error('Failed to load protocols', e); }
  })(); }, []);

  // Autosave to localStorage as a draft
  useEffect(() => { if (data) { const draft = { ...data, updated: new Date().toISOString() }; localStorage.setItem('protocols_draft', JSON.stringify(draft)); } }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as Protocol[];
    const q = query.toLowerCase();
    return data.protocols.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.triggers||[]).some(t => t.toLowerCase().includes(q)));
  }, [data, query]);

  const selected = useMemo(() => filtered.find(p => p.id === selectedId) || filtered[0] || null, [filtered, selectedId]);

  const updateProtocol = (patch: Partial<Protocol>) => {
    if (!data || !selected) return;
    const next = { ...selected, ...patch } as Protocol;
    setData({ ...data, protocols: data.protocols.map(p => p.id === selected.id ? next : p) });
  };

  const addRule = () => {
    if (!data || !selected) return;
    const r: Rule = { id: 'r_' + uid(), type: 'contains_any', subject: 'ingredients', path: 'ingredients[].name', operator: 'includes', value: [], severity: 'info', message: 'New rule' };
    updateProtocol({ rules: [...(selected.rules||[]), r] });
  };

  const addProtocol = () => {
    if (!data) return;
    const p: Protocol = { id: 'p_' + uid(), name: 'New Protocol', category: 'Disease', triggers: [], rules: [], instructions: [] };
    const next = { ...data, protocols: [p, ...data.protocols] };
    setData(next);
    setSelectedId(p.id);
    setEditMode(true);
  };

  const download = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clinical_protocols.json'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen bg-white grid grid-cols-12 gap-6">
      <aside className="col-span-4 border-r p-4">
        <div className="flex items-center gap-2 mb-3">
          <input className="border px-3 py-1 w-full" placeholder="Search diagnosis / category / trigger" value={query} onChange={e=>setQuery(e.target.value)} />
          <button className="px-3 py-1 border bg-gray-50" onClick={addProtocol}>+ Add</button>
        </div>
        <div className="space-y-1 overflow-auto max-h-[80vh]">
          {filtered.map(p => (
            <div key={p.id} onClick={()=>setSelectedId(p.id)} className={`p-2 border ${selected?.id===p.id?'bg-black text-white':'bg-white'} cursor-pointer`}>
              <div className="text-sm font-bold">{p.name}</div>
              <div className="text-[10px] uppercase text-gray-500">{p.category} · {(p.triggers||[]).join(', ')}</div>
            </div>
          ))}
          {filtered.length===0 && <div className="text-xs text-gray-400 italic">No matches.</div>}
        </div>
      </aside>

      <main className="col-span-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black uppercase tracking-tight">Clinical Protocols Database</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={editMode} onChange={e=>setEditMode(e.target.checked)} /> Edit mode</label>
            <button className="px-3 py-1 border" onClick={download}>Export JSON</button>
            <button className="px-3 py-1 border" onClick={()=>{ localStorage.removeItem('protocols_draft'); setMsg('Local draft cleared.'); }}>Clear Draft</button>
          </div>
        </div>

        {!selected && <div className="text-sm text-gray-500">Select a protocol on the left.</div>}
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Name</div>
                <input className="border px-3 py-1 w-full" disabled={!editMode} value={selected.name} onChange={e=>updateProtocol({name:e.target.value})} />
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Category</div>
                <select className="border px-3 py-1 w-full" disabled={!editMode} value={selected.category} onChange={e=>updateProtocol({category:e.target.value})}>
                  {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase text-gray-500 mb-1">Triggers (comma separated)</div>
                <input className="border px-3 py-1 w-full" disabled={!editMode} value={(selected.triggers||[]).join(', ')} onChange={e=>updateProtocol({triggers:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
              </div>
            </div>

            <div className="mt-2">
              <div className="text-[10px] uppercase text-gray-500 mb-1">Instructions (one per line)</div>
              <textarea className="border px-3 py-2 w-full h-24" disabled={!editMode} value={(selected.instructions||[]).join('\n')} onChange={e=>updateProtocol({instructions: e.target.value.split('\n').map(s=>s.trim()).filter(Boolean)})} />
            </div>

            <div className="mt-2">
              <div className="text-[10px] uppercase text-gray-500 mb-1">Spec (read-only)</div>
              <div className="border p-3 bg-gray-50 text-[12px]">
                <div><span className="uppercase text-gray-400">ID:</span> {selected.id}</div>
                <div><span className="uppercase text-gray-400">Category:</span> {selected.category}</div>
                <div><span className="uppercase text-gray-400">Triggers:</span> {(selected.triggers||[]).join(', ') || '—'}</div>
                <div><span className="uppercase text-gray-400">Instructions:</span> {(selected.instructions||[]).length||0}</div>
                <div className="mt-2">
                  <pre className="text-[11px] bg-white border p-2 overflow-auto max-h-48">{JSON.stringify(selected, null, 2)}</pre>
                </div>
                <div className="mt-2">
                  <a className="text-xs underline text-blue-600" href={`?view=protocols&protocol=${selected.id}`}>Open spec link</a>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <h3 className="font-black tracking-widest text-[10px] uppercase">Rules</h3>
              {editMode && <button className="px-3 py-1 border" onClick={addRule}>+ Add rule</button>}
            </div>
            <div className="space-y-3">
              {(selected.rules||[]).map((r,idx)=> (
                <div key={r.id} className="border p-2">
                  <div className="grid grid-cols-6 gap-2 text-[12px]">
                    <input className="border px-2 py-1" disabled={!editMode} value={r.type} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,type:e.target.value}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} value={r.subject} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,subject:e.target.value}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} value={r.path} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,path:e.target.value}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} value={r.operator} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,operator:e.target.value}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} value={Array.isArray(r.value)? r.value.join(', '): String(r.value??'')} onChange={e=>{ const rules=[...selected.rules]; const val=e.target.value.includes(',')? e.target.value.split(',').map(s=>s.trim()).filter(Boolean): e.target.value; rules[idx]={...r,value:val}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} value={r.severity} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,severity:e.target.value}; updateProtocol({rules}); }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[12px]">
                    <input className="border px-2 py-1" disabled={!editMode} value={r.message} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,message:e.target.value}; updateProtocol({rules}); }} />
                    <input className="border px-2 py-1" disabled={!editMode} placeholder="Suggestion (optional)" value={r.suggestion||''} onChange={e=>{ const rules=[...selected.rules]; rules[idx]={...r,suggestion:e.target.value}; updateProtocol({rules}); }} />
                  </div>
                </div>
              ))}
              {(selected.rules||[]).length===0 && <div className="text-xs text-gray-400">No rules yet.</div>}
            </div>

            {msg && <div className={`text-xs mt-3 ${String(msg).toLowerCase().includes('saved')? 'text-emerald-600':'text-red-600'}`}>{msg}</div>}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProtocolsAdmin;
