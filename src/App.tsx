import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { captureHandoffToken, apiGet, apiPost, apiPatch, apiDelete, getToken } from './lib/api';
import { CareerSite } from './CareerSite';
import { Briefcase, Users, SlidersHorizontal, Plus, X, MapPin, Building2, Globe, Download as Import, UserPlus, ArrowLeft, CalendarClock, ClipboardList, FileSignature, Send, Check, Trash2, Mail, FolderPlus, ExternalLink, Copy } from 'lucide-react';

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
  const [openApp, setOpenApp] = useState<string | null>(null);
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
                  <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)} onClick={() => setOpenApp(a.id)} className="rounded-lg border border-ink-100 bg-ink-50/50 px-2.5 py-2 text-sm cursor-pointer hover:border-ink-300 active:cursor-grabbing">
                    <div className="font-medium text-ink-800">{a.candidate.firstName} {a.candidate.lastName}</div>
                    <div className="text-[11px] text-ink-400 flex items-center gap-2">{a.candidate.location && <span>{a.candidate.location}</span>}<span className="capitalize">{a.source}</span>{a.matchScore != null && <span className="text-accent">{a.matchScore}% match</span>}</div>
                    {st.type !== 'hired' && <button onClick={(e) => { e.stopPropagation(); setStatus.mutate({ id: a.id, status: 'rejected' }); }} className="mt-1 text-[10px] text-ink-300 hover:text-rose-500">Reject</button>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {addOpen && <AddCandidateModal vacancyId={id} onClose={() => { setAddOpen(false); inval(); }} />}
      {openApp && <ApplicationDetail id={openApp} onClose={() => { setOpenApp(null); inval(); }} />}
    </div>
  );
}

// ── Application detail: candidate + interviews + scorecards + offer (e-sign) ──────
interface ApiInterview { id: string; title: string; scheduledAt: string | null; durationMins: number; interviewers: string | null; mode: string; status: string }
interface ApiScorecard { id: string; interviewerName: string | null; ratings: Record<string, number> | null; overall: string; comments: string | null; createdAt: string }
interface ApiOffer { id: string; title: string | null; body: string | null; salary: number | null; currency: string; startDate: string | null; status: string; signToken: string | null; signerName: string | null; signedAt: string | null; sentAt: string | null }
interface AppDetail {
  id: string; status: string; source: string; matchScore: number | null; appliedAt: string; screeningAnswers: Record<string, string> | null;
  vacancy: { id: string; title: string; slug: string };
  candidate: { id: string; firstName: string; lastName: string; email: string; phone: string | null; location: string | null; linkedinUrl: string | null; source: string; aiSummary: string | null; hasResume: boolean; resumeName: string | null };
  interviews: ApiInterview[]; scorecards: ApiScorecard[]; offers: ApiOffer[];
}
const OVERALL: Record<string, { label: string; cls: string }> = {
  strong_yes: { label: 'Strong yes', cls: 'bg-emerald-100 text-emerald-700' }, yes: { label: 'Yes', cls: 'bg-emerald-50 text-emerald-600' },
  no_decision: { label: 'No decision', cls: 'bg-ink-100 text-ink-500' }, no: { label: 'No', cls: 'bg-rose-50 text-rose-600' }, strong_no: { label: 'Strong no', cls: 'bg-rose-100 text-rose-700' },
};
const OFFER_STATUS: Record<string, string> = { draft: 'bg-ink-100 text-ink-500', approved: 'bg-sky-100 text-sky-700', sent: 'bg-amber-100 text-amber-700', accepted: 'bg-emerald-100 text-emerald-700', declined: 'bg-rose-100 text-rose-700' };
const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Panel({ icon: Icon, title, action, children }: { icon: typeof CalendarClock; title: string; action?: ReactNode; children: ReactNode }) {
  return <div><div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-ink-400" /><h3 className="text-sm font-semibold text-ink-700 flex-1">{title}</h3>{action}</div>{children}</div>;
}
const AddBtn = ({ onClick, open }: { onClick: () => void; open: boolean }) => <button onClick={onClick} className="text-xs text-accent">{open ? 'Close' : '+ Add'}</button>;
const Empty = ({ children }: { children: ReactNode }) => <p className="text-xs text-ink-400 py-1">{children}</p>;

function ApplicationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['application', id], queryFn: () => apiGet<{ application: AppDetail }>(`/api/applications/${id}`) });
  const inval = () => qc.invalidateQueries({ queryKey: ['application', id] });
  const a = q.data?.application;
  const downloadResume = async () => {
    if (!a) return;
    const res = await fetch(`/api/candidates/${a.candidate.id}/resume`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a'); link.href = url; link.download = a.candidate.resumeName || 'resume'; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <Modal wide onClose={onClose} title={a ? `${a.candidate.firstName} ${a.candidate.lastName}` : 'Candidate'}>
      {!a ? <p className="text-sm text-ink-400">Loading…</p> : (
        <div className="space-y-5">
          <div className="text-sm text-ink-500 flex flex-wrap items-center gap-x-3 gap-y-1 -mt-1">
            <span>{a.candidate.email}</span>
            {a.candidate.location && <span>· {a.candidate.location}</span>}
            <span>· for <b className="text-ink-700">{a.vacancy.title}</b></span>
            {a.candidate.linkedinUrl && <a href={a.candidate.linkedinUrl} target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-0.5">LinkedIn <ExternalLink className="w-3 h-3" /></a>}
            {a.candidate.hasResume && <button onClick={downloadResume} className="text-accent inline-flex items-center gap-0.5">Résumé <Import className="w-3 h-3" /></button>}
          </div>
          <InterviewsPanel appId={id} interviews={a.interviews} onChange={inval} />
          <ScorecardsPanel appId={id} scorecards={a.scorecards} onChange={inval} />
          <OfferPanel appId={id} slug={a.vacancy.slug} candidateName={`${a.candidate.firstName} ${a.candidate.lastName}`} role={a.vacancy.title} offers={a.offers} onChange={inval} />
        </div>
      )}
    </Modal>
  );
}

function InterviewsPanel({ appId, interviews, onChange }: { appId: string; interviews: ApiInterview[]; onChange: () => void }) {
  const blank = { title: 'Interview', scheduledAt: '', durationMins: 45, interviewers: '', mode: 'video' };
  const [open, setOpen] = useState(false); const [f, setF] = useState(blank);
  const add = useMutation({ mutationFn: () => apiPost(`/api/applications/${appId}/interviews`, { title: f.title, scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : null, durationMins: Number(f.durationMins) || 45, interviewers: f.interviewers || null, mode: f.mode }), onSuccess: () => { setOpen(false); setF(blank); onChange(); } });
  const setStatus = useMutation({ mutationFn: (v: { id: string; status: string }) => apiPatch(`/api/interviews/${v.id}`, { status: v.status }), onSuccess: onChange });
  const del = useMutation({ mutationFn: (iid: string) => apiDelete(`/api/interviews/${iid}`), onSuccess: onChange });
  return (
    <Panel icon={CalendarClock} title="Interviews" action={<AddBtn onClick={() => setOpen((o) => !o)} open={open} />}>
      {open && (
        <div className="rounded-lg border border-ink-200 p-3 space-y-2 mb-2 bg-ink-50/50">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></label>
            <label className="text-xs">Mode<select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={inputCls}><option value="video">Video</option><option value="onsite">On-site</option><option value="phone">Phone</option></select></label>
            <label className="text-xs">When<input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} className={inputCls} /></label>
            <label className="text-xs">Duration (min)<input type="number" value={f.durationMins} onChange={(e) => setF({ ...f, durationMins: Number(e.target.value) })} className={inputCls} /></label>
          </div>
          <label className="text-xs block">Interviewers<input value={f.interviewers} onChange={(e) => setF({ ...f, interviewers: e.target.value })} placeholder="names or emails" className={inputCls} /></label>
          <button onClick={() => f.title.trim() && add.mutate()} disabled={add.isPending} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">Schedule</button>
        </div>
      )}
      {interviews.length === 0 ? <Empty>No interviews scheduled.</Empty> : (
        <div className="space-y-1.5">{interviews.map((iv) => (
          <div key={iv.id} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink-800 truncate">{iv.title} <span className="text-[11px] text-ink-400 capitalize">· {iv.mode}</span></div>
              <div className="text-[11px] text-ink-400">{iv.scheduledAt ? fmtDateTime(iv.scheduledAt) : 'unscheduled'} · {iv.durationMins}m{iv.interviewers ? ` · ${iv.interviewers}` : ''}</div>
            </div>
            <select value={iv.status} onChange={(e) => setStatus.mutate({ id: iv.id, status: e.target.value })} className="text-[11px] border border-ink-200 rounded px-1 py-0.5"><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
            <button onClick={() => del.mutate(iv.id)} className="text-ink-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}</div>
      )}
    </Panel>
  );
}

function ScorecardsPanel({ appId, scorecards, onChange }: { appId: string; scorecards: ApiScorecard[]; onChange: () => void }) {
  const comps = useQuery({ queryKey: ['competencies'], queryFn: () => apiGet<{ competencies: string[] }>('/api/scorecard-competencies') });
  const competencies = comps.data?.competencies ?? [];
  const [open, setOpen] = useState(false); const [ratings, setRatings] = useState<Record<string, number>>({}); const [overall, setOverall] = useState('yes'); const [comments, setComments] = useState('');
  const reset = () => { setOpen(false); setRatings({}); setComments(''); setOverall('yes'); };
  const add = useMutation({ mutationFn: () => apiPost(`/api/applications/${appId}/scorecards`, { ratings: Object.keys(ratings).length ? ratings : null, overall, comments: comments || null }), onSuccess: () => { reset(); onChange(); } });
  const del = useMutation({ mutationFn: (sid: string) => apiDelete(`/api/scorecards/${sid}`), onSuccess: onChange });
  return (
    <Panel icon={ClipboardList} title="Scorecards" action={<AddBtn onClick={() => setOpen((o) => !o)} open={open} />}>
      {open && (
        <div className="rounded-lg border border-ink-200 p-3 space-y-2 mb-2 bg-ink-50/50">
          {competencies.map((c) => (
            <div key={c} className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-600">{c}</span>
              <div className="flex gap-1">{[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setRatings((r) => ({ ...r, [c]: n }))} className={`w-6 h-6 rounded text-[11px] ${ratings[c] === n ? 'bg-accent text-white' : 'bg-ink-100 text-ink-500'}`}>{n}</button>
              ))}</div>
            </div>
          ))}
          <label className="text-xs block">Overall<select value={overall} onChange={(e) => setOverall(e.target.value)} className={inputCls}><option value="strong_yes">Strong yes</option><option value="yes">Yes</option><option value="no_decision">No decision</option><option value="no">No</option><option value="strong_no">Strong no</option></select></label>
          <label className="text-xs block">Comments<textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={inputCls} /></label>
          <button onClick={() => add.mutate()} disabled={add.isPending} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">Submit scorecard</button>
        </div>
      )}
      {scorecards.length === 0 ? <Empty>No feedback yet.</Empty> : (
        <div className="space-y-1.5">{scorecards.map((s) => (
          <div key={s.id} className="rounded-lg border border-ink-100 px-3 py-2 text-sm">
            <div className="flex items-center gap-2"><span className="flex-1 font-medium text-ink-700 truncate">{s.interviewerName}</span><span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${OVERALL[s.overall]?.cls ?? ''}`}>{OVERALL[s.overall]?.label ?? s.overall}</span><button onClick={() => del.mutate(s.id)} className="text-ink-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
            {s.ratings && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-500">{Object.entries(s.ratings).map(([k, v]) => <span key={k}>{k}: <b className="text-ink-700">{v}/4</b></span>)}</div>}
            {s.comments && <p className="mt-1 text-xs text-ink-500 whitespace-pre-wrap">{s.comments}</p>}
          </div>
        ))}</div>
      )}
    </Panel>
  );
}

function OfferPanel({ appId, slug, candidateName, role, offers, onChange }: { appId: string; slug: string; candidateName: string; role: string; offers: ApiOffer[]; onChange: () => void }) {
  const current = offers.find((o) => o.status !== 'declined') || offers[0];
  const [creating, setCreating] = useState(false); const [copied, setCopied] = useState(false);
  const [f, setF] = useState({ salary: '', currency: '£', startDate: '', body: `Dear ${candidateName.split(' ')[0]},\n\nWe are delighted to offer you the role of ${role}. We were impressed throughout the process and would love for you to join the team.\n\nPlease review the details below and sign to accept.` });
  const create = useMutation({ mutationFn: () => apiPost(`/api/applications/${appId}/offers`, { title: `Offer — ${role}`, body: f.body, salary: f.salary ? Number(f.salary) : null, currency: f.currency, startDate: f.startDate ? new Date(f.startDate).toISOString() : null }), onSuccess: () => { setCreating(false); onChange(); } });
  const setStatus = useMutation({ mutationFn: (status: string) => apiPatch(`/api/offers/${current!.id}`, { status }), onSuccess: onChange });
  const del = useMutation({ mutationFn: () => apiDelete(`/api/offers/${current!.id}`), onSuccess: onChange });
  const link = current?.signToken ? `${window.location.origin}/careers/${slug}/offer/${current.signToken}` : '';
  const copy = () => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const showCreate = creating || !current;
  return (
    <Panel icon={FileSignature} title="Offer">
      {showCreate ? (
        <div className="rounded-lg border border-ink-200 p-3 space-y-2 bg-ink-50/50">
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">Salary<input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value })} className={inputCls} /></label>
            <label className="text-xs">Currency<input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} /></label>
            <label className="text-xs">Start date<input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} /></label>
          </div>
          <label className="text-xs block">Offer letter<textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} className={inputCls} /></label>
          <div className="flex gap-2"><button onClick={() => create.mutate()} disabled={create.isPending} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">Save draft</button>{offers.length > 0 && <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg border border-ink-200 text-xs">Cancel</button>}</div>
        </div>
      ) : !current ? <Empty>No offer yet.</Empty> : (
        <div className="rounded-lg border border-ink-100 p-3 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium text-ink-800">{current.currency}{current.salary?.toLocaleString() ?? '—'}{current.startDate ? ` · starts ${fmtDate(current.startDate)}` : ''}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${OFFER_STATUS[current.status] ?? ''}`}>{current.status}</span>
          </div>
          {current.body && <p className="text-xs text-ink-500 whitespace-pre-wrap border-t border-ink-100 pt-2">{current.body}</p>}
          {current.status === 'draft' && <div className="flex gap-2"><button onClick={() => setStatus.mutate('approved')} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">Approve</button><button onClick={() => del.mutate()} className="px-3 py-1.5 rounded-lg border border-ink-200 text-xs text-rose-600">Delete</button></div>}
          {current.status === 'approved' && <button onClick={() => setStatus.mutate('sent')} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Send to candidate</button>}
          {current.status === 'sent' && (
            <div className="border-t border-ink-100 pt-2">
              <p className="text-[11px] text-ink-400 mb-1">Share this secure link for the candidate to review &amp; e-sign:</p>
              <div className="flex items-center gap-1.5"><input readOnly value={link} className={`${inputCls} text-[11px]`} /><button onClick={copy} className="px-2 py-1.5 rounded-lg border border-ink-200 text-xs">{copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}</button><a href={link} target="_blank" rel="noreferrer" className="px-2 py-1.5 rounded-lg border border-ink-200 text-xs"><ExternalLink className="w-3.5 h-3.5" /></a></div>
            </div>
          )}
          {current.status === 'accepted' && <p className="text-xs text-emerald-700 border-t border-ink-100 pt-2 inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Accepted &amp; signed by <b>{current.signerName}</b>{current.signedAt ? ` on ${fmtDate(current.signedAt)}` : ''}</p>}
          {current.status === 'declined' && <p className="text-xs text-rose-600 border-t border-ink-100 pt-2">Candidate declined. <button onClick={() => setCreating(true)} className="text-accent underline">Create a new offer</button></p>}
        </div>
      )}
    </Panel>
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

interface Pool { id: string; name: string; description: string | null; memberCount: number; memberIds: string[] }

function CandidatesView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['candidates'], queryFn: () => apiGet<{ candidates: { id: string; name: string; email: string; location: string | null; source: string; applications: number; createdAt: string }[] }>('/api/candidates') });
  const poolsQ = useQuery({ queryKey: ['pools'], queryFn: () => apiGet<{ pools: Pool[] }>('/api/talent-pools') });
  const cands = q.data?.candidates ?? []; const pools = poolsQ.data?.pools ?? [];
  const [showPool, setShowPool] = useState(false);
  const invalPools = () => qc.invalidateQueries({ queryKey: ['pools'] });
  const addTo = useMutation({ mutationFn: (v: { poolId: string; candidateId: string }) => apiPatch(`/api/talent-pools/${v.poolId}`, { addCandidateId: v.candidateId }), onSuccess: invalPools });
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl font-semibold mb-1">Candidates</h1>
      <p className="text-sm text-ink-500 mb-5">Your talent database and pools across all jobs.</p>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold text-ink-700 inline-flex items-center gap-1.5"><FolderPlus className="w-4 h-4 text-ink-400" /> Talent pools</h2><button onClick={() => setShowPool(true)} className="text-xs text-accent">+ New pool</button></div>
        {pools.length === 0 ? <p className="text-xs text-ink-400">No pools yet — group prospects to re-engage later (e.g. “Silver medalists”, “Future engineers”).</p> : (
          <div className="flex flex-wrap gap-2">{pools.map((p) => (<span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs" title={p.description ?? ''}><span className="font-medium text-ink-700">{p.name}</span><span className="text-ink-400">{p.memberCount}</span></span>))}</div>
        )}
      </div>

      {cands.length === 0 ? <p className="text-sm text-ink-400 py-10 text-center">No candidates yet.</p> : (
        <div className="rounded-xl border border-ink-200 bg-white divide-y divide-ink-100">{cands.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1 min-w-0"><span className="font-medium text-ink-800">{c.name}</span><span className="text-xs text-ink-400 ml-2">{c.email}</span></span>
            <span className="text-xs text-ink-400 capitalize">{c.source}</span>
            <span className="text-xs text-ink-500">{c.applications} app{c.applications === 1 ? '' : 's'}</span>
            {pools.length > 0 && <select value="" onChange={(e) => { if (e.target.value) addTo.mutate({ poolId: e.target.value, candidateId: c.id }); }} className="text-[11px] border border-ink-200 rounded px-1 py-0.5 text-ink-500"><option value="">+ pool</option>{pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          </div>
        ))}</div>
      )}
      {showPool && <NewPoolModal onClose={() => { setShowPool(false); invalPools(); }} />}
    </div>
  );
}

function NewPoolModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', description: '' });
  const create = useMutation({ mutationFn: () => apiPost('/api/talent-pools', { name: f.name, description: f.description || null }), onSuccess: onClose });
  return (
    <Modal onClose={onClose} title="New talent pool">
      <label className="text-sm block">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="e.g. Silver medalists" /></label>
      <label className="text-sm block">Description<textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inputCls} /></label>
      <button onClick={() => f.name.trim() && create.mutate()} disabled={!f.name.trim() || create.isPending} className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-40">Create pool</button>
    </Modal>
  );
}

function SettingsView({ orgSlug }: { orgSlug: string }) {
  const q = useQuery({ queryKey: ['rec-settings'], queryFn: () => apiGet<{ settings: { careerSiteTitle: string | null; careerSiteIntro: string | null; aiEnabled: boolean } }>('/api/settings') });
  const save = useMutation({ mutationFn: (patch: Record<string, unknown>) => apiPatch('/api/settings', patch) });
  const s = q.data?.settings;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-ink-500">Career-site branding, email templates and recruitment options.</p>
      </div>
      {!s ? <p className="text-sm text-ink-400">Loading…</p> : (
        <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3">
          <label className="text-sm block">Career-site title<input defaultValue={s.careerSiteTitle ?? ''} onBlur={(e) => save.mutate({ careerSiteTitle: e.target.value })} placeholder="Careers at your company" className={inputCls} /></label>
          <label className="text-sm block">Intro<textarea defaultValue={s.careerSiteIntro ?? ''} onBlur={(e) => save.mutate({ careerSiteIntro: e.target.value })} rows={3} className={inputCls} /></label>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" defaultChecked={s.aiEnabled} onChange={(e) => save.mutate({ aiEnabled: e.target.checked })} /> AI assistance (JD generation, CV summaries, matching)</label>
          <p className="text-xs text-ink-400 pt-2 border-t border-ink-100">Public career site (P1): <code>/careers/{orgSlug}</code></p>
        </div>
      )}
      <EmailTemplatesCard />
    </div>
  );
}

interface Template { id: string; name: string; subject: string; body: string; kind: string }

function EmailTemplatesCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['email-templates'], queryFn: () => apiGet<{ templates: Template[] }>('/api/email-templates') });
  const [edit, setEdit] = useState<Template | 'new' | null>(null);
  const templates = q.data?.templates ?? [];
  const inval = () => qc.invalidateQueries({ queryKey: ['email-templates'] });
  return (
    <div>
      <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold text-ink-700 inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-ink-400" /> Email templates</h2><button onClick={() => setEdit('new')} className="text-xs text-accent">+ New template</button></div>
      <div className="rounded-xl border border-ink-200 bg-white divide-y divide-ink-100">
        {q.isLoading ? <p className="text-sm text-ink-400 p-4">Loading…</p> : templates.length === 0 ? <p className="text-sm text-ink-400 p-4">No templates.</p> : templates.map((t) => (
          <button key={t.id} onClick={() => setEdit(t)} className="w-full text-left px-4 py-2.5 hover:bg-ink-50">
            <div className="flex items-center gap-2"><span className="font-medium text-sm text-ink-800 flex-1 truncate">{t.name}</span><span className="text-[11px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-500 capitalize">{t.kind}</span></div>
            <div className="text-xs text-ink-400 truncate">{t.subject}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-400 mt-1.5">Placeholders: <code>{'{{firstName}}'}</code>, <code>{'{{role}}'}</code>, <code>{'{{company}}'}</code>.</p>
      {edit && <TemplateModal template={edit === 'new' ? null : edit} onClose={() => { setEdit(null); inval(); }} />}
    </div>
  );
}

function TemplateModal({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const [f, setF] = useState({ name: template?.name ?? '', subject: template?.subject ?? '', body: template?.body ?? '', kind: template?.kind ?? 'general' });
  const save = useMutation({ mutationFn: () => (template ? apiPatch(`/api/email-templates/${template.id}`, f) : apiPost('/api/email-templates', f)), onSuccess: onClose });
  const del = useMutation({ mutationFn: () => apiDelete(`/api/email-templates/${template!.id}`), onSuccess: onClose });
  const ok = f.name.trim() && f.subject.trim() && f.body.trim();
  return (
    <Modal wide onClose={onClose} title={template ? 'Edit template' : 'New template'}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></label>
        <label className="text-sm">Kind<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}><option value="ack">Acknowledgement</option><option value="invite">Interview invite</option><option value="reject">Rejection</option><option value="offer">Offer</option><option value="general">General</option></select></label>
      </div>
      <label className="text-sm block">Subject<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={inputCls} /></label>
      <label className="text-sm block">Body<textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={8} className={inputCls} /></label>
      <div className="flex gap-2"><button onClick={() => ok && save.mutate()} disabled={!ok || save.isPending} className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-40">Save</button>{template && <button onClick={() => del.mutate()} className="px-4 py-2 rounded-lg border border-ink-200 text-sm text-rose-600">Delete</button>}</div>
    </Modal>
  );
}

function Modal({ children, title, onClose, wide }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4" onClick={onClose}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[88vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5 space-y-3`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between sticky -top-5 bg-white py-1"><h2 className="font-serif text-xl font-semibold">{title}</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100"><X className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
