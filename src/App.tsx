import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { captureHandoffToken, apiGet, apiPost, apiPatch, getToken } from './lib/api';
import { CareerSite } from './CareerSite';
import { Briefcase, Users, SlidersHorizontal, Plus, X, MapPin, Building2, Globe, Download as Import, UserPlus, ArrowLeft } from 'lucide-react';

captureHandoffToken();

interface Me { email: string; role: string; orgSlug: string; orgName: string; canEdit: boolean }
interface VacancyRow { id: string; title: string; department: string | null; location: string | null; employmentType: string; remote: string; status: string; openings: number; slug: string; applications: number }
interface Position { id: string; title: string; department: string | null; location: string | null; openings: number }
interface Stage { id: string; name: string; type: string; orderIndex: number }
interface AppCard { id: string; stageId: string | null; status: string; source: string; matchScore: number | null; appliedAt: string; candidate: { firstName: string; lastName: string; email: string; location: string | null; source: string } }

const STATUS_CLS: Record<string, string> = { draft: 'bg-ink-100 text-ink-500', pending_approval: 'bg-amber-100 text-amber-700', published: 'bg-emerald-100 text-emerald-700', on_hold: 'bg-amber-100 text-amber-700', filled: 'bg-sky-100 text-sky-700', closed: 'bg-ink-100 text-ink-400' };
const EMP_LABEL: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', temp: 'Temp', intern: 'Intern' };
const inputCls = 'text-sm border border-ink-300 rounded px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent';

export function App() {
  // Public career site — no auth, no SSO. Served at /careers/<slug> OR the branded
  // per-tenant subdomain <slug>.careers.mverseapps.app (host-based resolution).
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/careers/') || /\.careers\./i.test(window.location.hostname))) return <CareerSite />;
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/api/me'), retry: false });
  if (me.isLoading) return <div className="h-screen grid place-items-center text-ink-400 text-sm">Loading…</div>;
  if (me.isError || !getToken()) return <SignedOut />;
  return <Shell me={me.data!} />;
}

function SignedOut() {
  return (
    <div className="h-screen grid place-items-center bg-ink-50 p-6 text-center">
      <div>
        <div className="inline-flex items-center gap-2 mb-4"><span className="h-10 w-10 rounded-xl bg-accent text-white grid place-items-center font-bold">Rec</span><span className="font-serif text-2xl font-semibold">Recruitment</span></div>
        <p className="text-ink-500 max-w-sm">Open this app from your MVerse workspace — sign in to People, then choose <b>Recruitment</b>.</p>
      </div>
    </div>
  );
}

function Shell({ me }: { me: Me }) {
  const [view, setView] = useState<{ name: 'jobs' } | { name: 'pipeline'; id: string; title: string } | { name: 'candidates' } | { name: 'settings' }>({ name: 'jobs' });
  const Nav = ({ icon: Icon, label, active, onClick }: { icon: typeof Briefcase; label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${active ? 'bg-accent/10 text-accent font-medium' : 'text-ink-600 hover:bg-ink-100'}`}><Icon className="w-4 h-4" /> {label}</button>
  );
  return (
    <div className="h-screen flex bg-ink-50 text-ink-900">
      <aside className="w-56 shrink-0 bg-white border-r border-ink-200/60 flex flex-col px-3 py-4">
        <div className="flex items-center gap-2 px-2 mb-5"><span className="h-8 w-8 rounded-lg bg-accent text-white grid place-items-center text-xs font-bold">Rec</span><span className="font-serif text-lg font-semibold">Recruitment</span></div>
        <nav className="flex flex-col gap-1">
          <Nav icon={Briefcase} label="Jobs" active={view.name === 'jobs' || view.name === 'pipeline'} onClick={() => setView({ name: 'jobs' })} />
          <Nav icon={Users} label="Candidates" active={view.name === 'candidates'} onClick={() => setView({ name: 'candidates' })} />
          <Nav icon={SlidersHorizontal} label="Settings" active={view.name === 'settings'} onClick={() => setView({ name: 'settings' })} />
        </nav>
        <div className="mt-auto px-2 text-xs text-ink-400">
          <a href={`https://${me.orgSlug}.mverseapps.app/`} className="hover:text-accent">← MVerse workspace</a>
          <div className="mt-1 truncate">{me.orgName}</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-7">
        {view.name === 'jobs' && <JobsView onOpen={(id, title) => setView({ name: 'pipeline', id, title })} />}
        {view.name === 'pipeline' && <PipelineView id={view.id} title={view.title} onBack={() => setView({ name: 'jobs' })} />}
        {view.name === 'candidates' && <CandidatesView />}
        {view.name === 'settings' && <SettingsView orgSlug={me.orgSlug} />}
      </main>
    </div>
  );
}

function JobsView({ onOpen }: { onOpen: (id: string, title: string) => void }) {
  const qc = useQueryClient(); const inval = () => qc.invalidateQueries({ queryKey: ['vacancies'] });
  const q = useQuery({ queryKey: ['vacancies'], queryFn: () => apiGet<{ vacancies: VacancyRow[] }>('/api/vacancies') });
  const [showNew, setShowNew] = useState(false); const [showPos, setShowPos] = useState(false);
  const vacancies = q.data?.vacancies ?? [];
  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div><h1 className="font-serif text-3xl font-semibold">Jobs</h1><p className="text-sm text-ink-500 mt-1">Open vacancies and their pipelines. Publish a vacant position from People, or create one here.</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowPos(true)} className="px-3 py-2 rounded-lg border border-ink-200 text-sm inline-flex items-center gap-1.5"><Import className="w-4 h-4" /> From People position</button>
          <button onClick={() => setShowNew(true)} className="px-3 py-2 rounded-lg bg-accent text-white text-sm inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> New job</button>
        </div>
      </div>
      {vacancies.length === 0 ? <p className="text-sm text-ink-400 py-10 text-center">No jobs yet — create one or publish a vacant position from People.</p> : (
        <div className="rounded-xl border border-ink-200 bg-white divide-y divide-ink-100">
          {vacancies.map((v) => (
            <button key={v.id} onClick={() => onOpen(v.id, v.title)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-50">
              <span className="flex-1 min-w-0"><span className="font-medium text-ink-800 block truncate">{v.title}</span><span className="text-xs text-ink-400 flex items-center gap-2 mt-0.5">{v.department && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{v.department}</span>}{v.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{v.location}</span>}<span>{EMP_LABEL[v.employmentType]}</span></span></span>
              <span className="text-xs text-ink-500">{v.applications} applicant{v.applications === 1 ? '' : 's'}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[v.status]}`}>{v.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}
      {showNew && <NewJobModal onClose={() => { setShowNew(false); inval(); }} />}
      {showPos && <PositionsModal onClose={() => { setShowPos(false); inval(); }} />}
    </div>
  );
}

function NewJobModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ title: '', department: '', location: '', employmentType: 'full_time', remote: 'onsite', description: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => apiPost('/api/vacancies', f), onSuccess: onClose });
  return (
    <Modal onClose={onClose} title="New job">
      <label className="text-sm block">Title<input value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="e.g. Senior Software Engineer" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Department<input value={f.department} onChange={(e) => set('department', e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Location<input value={f.location} onChange={(e) => set('location', e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Type<select value={f.employmentType} onChange={(e) => set('employmentType', e.target.value)} className={inputCls}>{Object.entries(EMP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="text-sm">Work<select value={f.remote} onChange={(e) => set('remote', e.target.value)} className={inputCls}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
      </div>
      <label className="text-sm block">Description<textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} className={inputCls} /></label>
      <button onClick={() => f.title.trim() && create.mutate()} disabled={!f.title.trim() || create.isPending} className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-40">Create</button>
    </Modal>
  );
}

function PositionsModal({ onClose }: { onClose: () => void }) {
  const q = useQuery({ queryKey: ['publishable-positions'], queryFn: () => apiGet<{ positions: Position[]; error?: string }>('/api/publishable-positions') });
  const publish = useMutation({ mutationFn: (positionId: string) => apiPost('/api/vacancies/from-position', { positionId }), onSuccess: onClose });
  const positions = q.data?.positions ?? [];
  return (
    <Modal onClose={onClose} title="Publish a vacant position from People">
      {q.isLoading ? <p className="text-sm text-ink-400">Loading positions…</p>
        : q.data?.error ? <p className="text-sm text-rose-600">Couldn't reach People ({q.data.error}).</p>
        : positions.length === 0 ? <p className="text-sm text-ink-400">No vacant positions found in People (or all are already published).</p>
        : <div className="space-y-1.5 max-h-80 overflow-y-auto">{positions.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm">
              <span className="flex-1"><span className="font-medium">{p.title}</span><span className="text-xs text-ink-400 ml-2">{p.department}{p.location ? ` · ${p.location}` : ''} · {p.openings} opening{p.openings === 1 ? '' : 's'}</span></span>
              <button onClick={() => publish.mutate(p.id)} disabled={publish.isPending} className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs">Publish</button>
            </div>
          ))}</div>}
    </Modal>
  );
}

function PipelineView({ id, title, onBack }: { id: string; title: string; onBack: () => void }) {
  const qc = useQueryClient(); const inval = () => qc.invalidateQueries({ queryKey: ['board', id] });
  const q = useQuery({ queryKey: ['board', id], queryFn: () => apiGet<{ vacancy: { id: string; title: string; status: string; slug: string }; stages: Stage[]; applications: AppCard[] }>(`/api/vacancies/${id}/board`) });
  const move = useMutation({ mutationFn: (v: { appId: string; stageId: string }) => apiPatch(`/api/applications/${v.appId}`, { stageId: v.stageId }), onSuccess: inval });
  const setStatus = useMutation({ mutationFn: (v: { id: string; status: string }) => apiPatch(`/api/applications/${v.id}`, v), onSuccess: inval });
  const publish = useMutation({ mutationFn: (status: string) => apiPatch(`/api/vacancies/${id}`, { status }), onSuccess: inval });
  const [addOpen, setAddOpen] = useState(false);
  const stages = q.data?.stages ?? []; const apps = q.data?.applications ?? []; const vac = q.data?.vacancy;
  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-accent mb-3"><ArrowLeft className="w-4 h-4" /> Jobs</button>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div><h1 className="font-serif text-2xl font-semibold">{vac?.title ?? title}</h1><div className="mt-1 flex items-center gap-2">{vac && <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[vac.status]}`}>{vac.status.replace('_', ' ')}</span>}<span className="text-xs text-ink-400">{apps.length} in pipeline</span></div></div>
        <div className="flex gap-2">
          <button onClick={() => setAddOpen(true)} className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm inline-flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Add candidate</button>
          {vac?.status !== 'published' ? <button onClick={() => publish.mutate('published')} className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm inline-flex items-center gap-1.5"><Globe className="w-4 h-4" /> Publish</button>
            : <button onClick={() => publish.mutate('on_hold')} className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm">Unpublish</button>}
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((st) => {
          const col = apps.filter((a) => a.stageId === st.id && a.status === 'active');
          return (
            <div key={st.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const appId = e.dataTransfer.getData('text/plain'); if (appId) move.mutate({ appId, stageId: st.id }); }}
              className="w-60 shrink-0 rounded-xl bg-white border border-ink-200 p-2">
              <div className="flex items-center justify-between px-1 mb-2"><span className="text-sm font-medium text-ink-700">{st.name}</span><span className="text-[11px] text-ink-400">{col.length}</span></div>
              <div className="space-y-1.5 min-h-[40px]">
                {col.map((a) => (
                  <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)} className="rounded-lg border border-ink-100 bg-ink-50/50 px-2.5 py-2 text-sm cursor-grab active:cursor-grabbing">
                    <div className="font-medium text-ink-800">{a.candidate.firstName} {a.candidate.lastName}</div>
                    <div className="text-[11px] text-ink-400 flex items-center gap-2">{a.candidate.location && <span>{a.candidate.location}</span>}<span className="capitalize">{a.source}</span>{a.matchScore != null && <span className="text-accent">{a.matchScore}% match</span>}</div>
                    {st.type !== 'hired' && <button onClick={() => setStatus.mutate({ id: a.id, status: 'rejected' })} className="mt-1 text-[10px] text-ink-300 hover:text-rose-500">Reject</button>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {addOpen && <AddCandidateModal vacancyId={id} onClose={() => { setAddOpen(false); inval(); }} />}
    </div>
  );
}

function AddCandidateModal({ vacancyId, onClose }: { vacancyId: string; onClose: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', location: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const add = useMutation({ mutationFn: () => apiPost(`/api/vacancies/${vacancyId}/applications`, { ...f, source: 'sourced' }), onSuccess: onClose });
  const ok = f.firstName.trim() && f.lastName.trim() && /.+@.+/.test(f.email);
  return (
    <Modal onClose={onClose} title="Add candidate">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">First name<input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Last name<input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} /></label>
      </div>
      <label className="text-sm block">Email<input value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></label>
      <label className="text-sm block">Location<input value={f.location} onChange={(e) => set('location', e.target.value)} className={inputCls} /></label>
      <button onClick={() => ok && add.mutate()} disabled={!ok || add.isPending} className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-40">Add to pipeline</button>
    </Modal>
  );
}

function CandidatesView() {
  const q = useQuery({ queryKey: ['candidates'], queryFn: () => apiGet<{ candidates: { id: string; name: string; email: string; location: string | null; source: string; applications: number; createdAt: string }[] }>('/api/candidates') });
  const cands = q.data?.candidates ?? [];
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl font-semibold mb-1">Candidates</h1>
      <p className="text-sm text-ink-500 mb-5">Everyone in your talent database across all jobs.</p>
      {cands.length === 0 ? <p className="text-sm text-ink-400 py-10 text-center">No candidates yet.</p> : (
        <div className="rounded-xl border border-ink-200 bg-white divide-y divide-ink-100">{cands.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className="flex-1"><span className="font-medium text-ink-800">{c.name}</span><span className="text-xs text-ink-400 ml-2">{c.email}</span></span><span className="text-xs text-ink-400 capitalize">{c.source}</span><span className="text-xs text-ink-500">{c.applications} app{c.applications === 1 ? '' : 's'}</span></div>
        ))}</div>
      )}
    </div>
  );
}

function SettingsView({ orgSlug }: { orgSlug: string }) {
  const q = useQuery({ queryKey: ['rec-settings'], queryFn: () => apiGet<{ settings: { careerSiteTitle: string | null; careerSiteIntro: string | null; aiEnabled: boolean } }>('/api/settings') });
  const save = useMutation({ mutationFn: (patch: Record<string, unknown>) => apiPatch('/api/settings', patch) });
  const s = q.data?.settings;
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold mb-1">Settings</h1>
      <p className="text-sm text-ink-500 mb-5">Career-site branding and recruitment options.</p>
      {!s ? <p className="text-sm text-ink-400">Loading…</p> : (
        <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3">
          <label className="text-sm block">Career-site title<input defaultValue={s.careerSiteTitle ?? ''} onBlur={(e) => save.mutate({ careerSiteTitle: e.target.value })} placeholder="Careers at your company" className={inputCls} /></label>
          <label className="text-sm block">Intro<textarea defaultValue={s.careerSiteIntro ?? ''} onBlur={(e) => save.mutate({ careerSiteIntro: e.target.value })} rows={3} className={inputCls} /></label>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" defaultChecked={s.aiEnabled} onChange={(e) => save.mutate({ aiEnabled: e.target.checked })} /> AI assistance (JD generation, CV summaries, matching)</label>
          <p className="text-xs text-ink-400 pt-2 border-t border-ink-100">Public career site (P1): <code>/careers/{orgSlug}</code></p>
        </div>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-semibold">{title}</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100"><X className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
