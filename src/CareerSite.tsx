import { useEffect, useState, type ReactNode, type ChangeEvent } from 'react';
import { MapPin, Building2, Briefcase, ArrowLeft, Upload, Check, Search } from 'lucide-react';

// Public career site — NO auth. Reached at /careers/<company-slug>. Uses the /api/public API.
const pget = <T,>(path: string): Promise<T> => fetch(`/api/public${path}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
const ppost = (path: string, body: unknown) => fetch(`/api/public${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, status: r.status }));

const EMP: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', temp: 'Temp', intern: 'Intern' };
const REMOTE: Record<string, string> = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };
const inputCls = 'w-full text-sm border border-ink-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent';
const money = (s: { min: number | null; max: number | null; currency: string } | null) => !s ? null : `${s.currency}${(s.min ?? s.max)?.toLocaleString()}${s.min && s.max ? `–${s.currency}${s.max.toLocaleString()}` : ''}`;

interface Site { orgName: string; title: string; intro: string | null; brandColor: string; openCount: number }
interface VacancyRow { id: string; title: string; department: string | null; location: string | null; remote: string; employmentType: string; salary: { min: number | null; max: number | null; currency: string } | null }

const Center = ({ children }: { children: ReactNode }) => <div className="min-h-screen grid place-items-center text-ink-500 p-8 text-center">{children}</div>;
const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// ── Candidate offer review + e-signature (no account) ───────────────────────────
interface OfferView { orgName: string; role: string; title: string; candidateName: string; salary: number | null; currency: string; startDate: string | null; body: string | null; status: string; signerName: string | null; signedAt: string | null }

function OfferSign({ slug, token }: { slug: string; token: string }) {
  const [o, setO] = useState<OfferView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [signer, setSigner] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);
  useEffect(() => { pget<{ offer: OfferView }>(`/${slug}/offer/${token}`).then((d) => setO(d.offer)).catch(() => setNotFound(true)); }, [slug, token]);
  if (notFound) return <Center>This offer link isn’t valid or has expired.</Center>;
  if (!o) return <Center>Loading…</Center>;
  const brand = '#ea580c';
  const accepted = o.status === 'accepted' || result === 'accepted';
  const declined = o.status === 'declined' || result === 'declined';
  const act = async (decision: 'accept' | 'decline') => {
    setBusy(true);
    const r = await ppost(`/${slug}/offer/${token}/sign`, { decision, signerName: decision === 'accept' ? signer.trim() : null });
    setBusy(false);
    if (r.ok) setResult(decision === 'accept' ? 'accepted' : 'declined');
  };
  return (
    <div className="min-h-screen bg-ink-50">
      <div className="h-2" style={{ background: brand }} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-xs text-ink-400">{o.orgName}</div>
        <h1 className="font-serif text-3xl font-semibold mt-1">{o.title}</h1>
        <p className="text-sm text-ink-500 mt-1">Prepared for {o.candidateName}</p>
        <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><div className="text-xs text-ink-400">Role</div><div className="font-medium text-ink-800">{o.role}</div></div>
            {o.salary != null && <div><div className="text-xs text-ink-400">Compensation</div><div className="font-medium text-ink-800">{o.currency}{o.salary.toLocaleString()}</div></div>}
            {o.startDate && <div><div className="text-xs text-ink-400">Start date</div><div className="font-medium text-ink-800">{fmtDate(o.startDate)}</div></div>}
          </div>
          {o.body && <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed border-t border-ink-100 pt-3">{o.body}</p>}
        </div>
        {accepted ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-2 text-white" style={{ background: brand }}><Check className="w-6 h-6" /></div>
            <h2 className="font-serif text-xl font-semibold text-emerald-800">Offer accepted</h2>
            <p className="text-sm text-emerald-700 mt-1">Signed by {o.signerName || signer}. Welcome aboard — {o.orgName} will be in touch with next steps.</p>
          </div>
        ) : declined ? (
          <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5 text-center text-ink-500">
            <h2 className="font-serif text-xl font-semibold text-ink-700">Offer declined</h2>
            <p className="text-sm mt-1">You’ve declined this offer. If this was a mistake, please contact {o.orgName}.</p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-700 mb-2">Review &amp; sign</h2>
            <p className="text-xs text-ink-400 mb-3">Type your full name to sign electronically. This constitutes your acceptance of the offer above.</p>
            <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Your full name" className={inputCls} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => act('accept')} disabled={!signer.trim() || busy} className="px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-40" style={{ background: brand }}>{busy ? 'Signing…' : 'Accept & sign'}</button>
              <button onClick={() => act('decline')} disabled={busy} className="px-5 py-2.5 rounded-lg border border-ink-200 text-ink-600 text-sm">Decline</button>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-ink-300 mt-8">Powered by MVerse Recruitment · e-signature</p>
      </div>
    </div>
  );
}

export function CareerSite() {
  // Tenant slug from the branded subdomain (<slug>.careers.mverseapps.app), else from /careers/<slug>.
  const hostMatch = window.location.hostname.match(/^([a-z0-9-]+)\.careers\./i);
  const slug = hostMatch ? hostMatch[1] : (window.location.pathname.split('/')[2] || '');
  // Candidate offer-signing link: …/offer/<token> (both branded-host and /careers/<slug> forms).
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const offerIdx = pathParts.indexOf('offer');
  if (offerIdx >= 0 && pathParts[offerIdx + 1]) return <OfferSign slug={slug} token={pathParts[offerIdx + 1]} />;
  const [site, setSite] = useState<Site | null>(null);
  const [vacancies, setVacancies] = useState<VacancyRow[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!slug) { setNotFound(true); return; }
    pget<Site>(`/${slug}/site`).then(setSite).catch(() => setNotFound(true));
    pget<{ vacancies: VacancyRow[] }>(`/${slug}/vacancies`).then((d) => setVacancies(d.vacancies || [])).catch(() => {});
  }, [slug]);

  if (notFound) return <Center>This careers page isn’t available.</Center>;
  if (!site) return <Center>Loading…</Center>;
  const brand = site.brandColor || '#ea580c';
  if (selected) return <VacancyDetail slug={slug} id={selected} brand={brand} orgName={site.orgName} onBack={() => setSelected(null)} />;

  const filtered = vacancies.filter((v) => `${v.title} ${v.department ?? ''} ${v.location ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="text-white" style={{ background: brand }}>
        <div className="max-w-3xl mx-auto px-6 py-14">
          <div className="text-sm/relaxed opacity-80">{site.orgName}</div>
          <h1 className="font-serif text-4xl font-semibold mt-1">{site.title}</h1>
          {site.intro && <p className="mt-3 text-white/90 max-w-xl">{site.intro}</p>}
          <p className="mt-4 text-sm text-white/80">{site.openCount} open role{site.openCount === 1 ? '' : 's'}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles…" className={`${inputCls} pl-9`} />
        </div>
        {filtered.length === 0 ? <p className="text-center text-ink-400 py-16">No open roles right now — check back soon.</p> : (
          <div className="space-y-2.5">
            {filtered.map((v) => (
              <button key={v.id} onClick={() => setSelected(v.id)} className="w-full text-left bg-white rounded-xl border border-ink-200 hover:border-ink-300 hover:shadow-sm transition px-5 py-4">
                <div className="font-medium text-ink-900">{v.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  {v.department && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{v.department}</span>}
                  {v.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{v.location}</span>}
                  <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{EMP[v.employmentType]} · {REMOTE[v.remote]}</span>
                  {money(v.salary) && <span className="font-medium" style={{ color: brand }}>{money(v.salary)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-ink-300 mt-10">Powered by MVerse Recruitment</p>
      </main>
    </div>
  );
}

interface VacancyFull { id: string; title: string; department: string | null; location: string | null; remote: string; employmentType: string; description: string; responsibilities: string | null; requirements: string | null; salary: { min: number | null; max: number | null; currency: string } | null; screeningQuestions: { id: string; question: string; required: boolean }[] }

function VacancyDetail({ slug, id, brand, orgName, onBack }: { slug: string; id: string; brand: string; orgName: string; onBack: () => void }) {
  const [v, setV] = useState<VacancyFull | null>(null);
  const [applying, setApplying] = useState(false);
  useEffect(() => { pget<{ vacancy: VacancyFull }>(`/${slug}/vacancies/${id}`).then((d) => setV(d.vacancy)).catch(() => setV(null)); }, [slug, id]);
  if (!v) return <Center>Loading…</Center>;
  return (
    <div className="min-h-screen bg-ink-50">
      <div className="h-2" style={{ background: brand }} />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 mb-4"><ArrowLeft className="w-4 h-4" /> All roles</button>
        <div className="text-xs text-ink-400">{orgName}</div>
        <h1 className="font-serif text-3xl font-semibold mt-1">{v.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-500">
          {v.department && <span className="inline-flex items-center gap-1"><Building2 className="w-4 h-4" />{v.department}</span>}
          {v.location && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{v.location}</span>}
          <span className="inline-flex items-center gap-1"><Briefcase className="w-4 h-4" />{EMP[v.employmentType]} · {REMOTE[v.remote]}</span>
          {money(v.salary) && <span className="font-medium" style={{ color: brand }}>{money(v.salary)}</span>}
        </div>
        {!applying ? (
          <>
            {v.description && <Section title="About the role" body={v.description} />}
            {v.responsibilities && <Section title="Responsibilities" body={v.responsibilities} />}
            {v.requirements && <Section title="Requirements" body={v.requirements} />}
            <button onClick={() => setApplying(true)} className="mt-8 px-5 py-2.5 rounded-lg text-white font-medium" style={{ background: brand }}>Apply for this role</button>
          </>
        ) : <ApplyForm slug={slug} vacancy={v} brand={brand} onBack={() => setApplying(false)} />}
      </div>
    </div>
  );
}

const Section = ({ title, body }: { title: string; body: string }) => (
  <div className="mt-6"><h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wide mb-1.5">{title}</h2><p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{body}</p></div>
);

function ApplyForm({ slug, vacancy, brand, onBack }: { slug: string; vacancy: VacancyFull; brand: string; onBack: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', location: '', linkedinUrl: '' });
  const set = (k: string, val: string) => setF((s) => ({ ...s, [k]: val }));
  const [resume, setResume] = useState<{ name: string; mime: string; data: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [eeo, setEeo] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState('');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('Résumé must be under 5MB.'); return; }
    const rd = new FileReader(); rd.onload = () => setResume({ name: file.name, mime: file.type, data: String(rd.result).split(',')[1] }); rd.readAsDataURL(file);
  };
  const reqOk = f.firstName.trim() && f.lastName.trim() && /.+@.+\..+/.test(f.email) && consent && vacancy.screeningQuestions.filter((q) => q.required).every((q) => (answers[q.id] || '').trim());
  const submit = async () => {
    setBusy(true); setErr('');
    const r = await ppost(`/${slug}/vacancies/${vacancy.id}/apply`, {
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone || null, location: f.location || null, linkedinUrl: f.linkedinUrl || null,
      resumeName: resume?.name, resumeMime: resume?.mime, resumeData: resume?.data,
      screeningAnswers: Object.keys(answers).length ? answers : null, eeo: Object.keys(eeo).length ? eeo : null, gdprConsent: true,
    });
    setBusy(false);
    if (r.ok) setDone(true); else setErr(r.status === 429 ? 'Too many attempts — please try again later.' : 'Something went wrong. Please try again.');
  };

  if (done) return (
    <div className="mt-10 text-center">
      <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-3 text-white" style={{ background: brand }}><Check className="w-7 h-7" /></div>
      <h2 className="font-serif text-2xl font-semibold">Application received</h2>
      <p className="text-sm text-ink-500 mt-1">Thanks for applying for <b>{vacancy.title}</b>. We’ll be in touch.</p>
    </div>
  );

  const EEO = [
    { key: 'gender', label: 'Gender', opts: ['Prefer not to say', 'Female', 'Male', 'Non-binary', 'Other'] },
    { key: 'ethnicity', label: 'Ethnicity', opts: ['Prefer not to say', 'Asian', 'Black', 'Hispanic/Latino', 'White', 'Mixed', 'Other'] },
    { key: 'disability', label: 'Disability status', opts: ['Prefer not to say', 'Yes', 'No'] },
  ];
  return (
    <div className="mt-6">
      <button onClick={onBack} className="text-sm text-ink-500 hover:text-ink-800 mb-3">← Back to role</button>
      <h2 className="font-serif text-xl font-semibold mb-3">Apply for {vacancy.title}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">First name *<input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Last name *<input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} /></label>
      </div>
      <label className="text-sm block mt-3">Email *<input value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></label>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="text-sm">Phone<input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Location<input value={f.location} onChange={(e) => set('location', e.target.value)} className={inputCls} /></label>
      </div>
      <label className="text-sm block mt-3">LinkedIn<input value={f.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/…" className={inputCls} /></label>
      <label className="text-sm block mt-3">Résumé / CV
        <div className="mt-1 flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ink-300 text-sm cursor-pointer hover:border-accent"><Upload className="w-4 h-4" /> Upload<input type="file" accept=".pdf,.doc,.docx,.txt" onChange={onFile} className="hidden" /></label>
          {resume && <span className="text-xs text-ink-500">{resume.name}</span>}
        </div>
      </label>

      {vacancy.screeningQuestions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-2">A few questions</h3>
          {vacancy.screeningQuestions.map((sq) => (
            <label key={sq.id} className="text-sm block mb-2">{sq.question}{sq.required ? ' *' : ''}<textarea value={answers[sq.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [sq.id]: e.target.value }))} rows={2} className={inputCls} /></label>
          ))}
        </div>
      )}

      <details className="mt-5 rounded-lg border border-ink-200 bg-white p-3">
        <summary className="text-sm font-medium text-ink-700 cursor-pointer">Equal‑opportunity monitoring (voluntary)</summary>
        <p className="text-xs text-ink-400 mt-2 mb-2">Optional and confidential. This is used only for equal‑opportunity monitoring and is kept separate from the hiring decision.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {EEO.map((e) => (
            <label key={e.key} className="text-xs text-ink-600">{e.label}<select value={eeo[e.key] || 'Prefer not to say'} onChange={(ev) => setEeo((s) => ({ ...s, [e.key]: ev.target.value }))} className={`${inputCls} mt-0.5`}>{e.opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          ))}
        </div>
      </details>

      <p className="text-[11px] text-ink-400 mt-4 leading-relaxed">We may use automated tools to help organise and review applications. A human makes all hiring decisions, and you can ask for your application to be reviewed without automated assistance.</p>
      <label className="flex items-start gap-2 text-xs text-ink-600 mt-3"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /><span>I consent to {vacancy.title ? 'this employer' : 'the employer'} storing and processing my personal data for this application, in line with their privacy policy. *</span></label>

      {err && <p className="text-sm text-rose-600 mt-3">{err}</p>}
      <button onClick={submit} disabled={!reqOk || busy} className="mt-4 px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-40" style={{ background: brand }}>{busy ? 'Submitting…' : 'Submit application'}</button>
    </div>
  );
}
