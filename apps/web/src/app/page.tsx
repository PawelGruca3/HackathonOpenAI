'use client';
import { useEffect, useRef, useState } from 'react';
import { DISCLAIMER, EMERGENCY_MESSAGE, regionLabel, type CasePacket } from '@intake/shared';
import dynamic from 'next/dynamic';
const CaseHeatmap = dynamic(() => import('../components/CaseHeatmap'), { ssr: false });

async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error || 'Unable to load intake. Please retry.'), { status: response.status });
  return body;
}
const date = (value: string) => new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [cases, setCases] = useState<CasePacket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [email, setEmail] = useState('doctor@demo.com');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CasePacket | null>(null);
  const [deleted, setDeleted] = useState<CasePacket | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const undoDeleteRef = useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(deleted)undoDeleteRef.current?.focus();},[deleted]);
  useEffect(() => {
    if (!deleteTarget) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    deleteDialogRef.current?.showModal();
    return () => { deleteDialogRef.current?.close(); previousFocus?.focus(); };
  }, [deleteTarget]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!preview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => { dialogRef.current?.close(); previousFocus?.focus(); };
  }, [preview]);
  const selected = cases.find(p => p.id === selectedId);
  const visible = cases.filter(p => `${p.symptoms} ${p.assessment?.specialty || ''} ${p.id}`.toLowerCase().includes(filter.toLowerCase()));
  async function refresh() {
    setLoading(true); setError('');
    try { const result = await api<CasePacket[]>('cases'); setCases(result); setAuthenticated(true); }
    catch (e) { if ((e as { status?: number }).status === 401) setAuthenticated(false); else setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => { void refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [authenticated]);
  useEffect(() => { setNote(''); setNotice(''); }, [selectedId]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try { await api('auth/login', { email, password }); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  async function saveNote(e: React.FormEvent) {
    e.preventDefault(); if (!selected || !note.trim() || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await api<CasePacket>(`cases/${selected.id}/annotations`, { text: note });
      setCases(current => current.map(p => p.id === updated.id ? updated : p)); setNote(''); setNotice('Note saved. It is now visible in the patient’s history.');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  async function deleteSelected() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setError('');
    try {
      const response = await fetch(`/api/cases/${deleteTarget.id}`, {method:'DELETE'});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to delete this case.');
      setCases(current=>current.filter(p=>p.id!==deleteTarget.id));setDeleted(deleteTarget);setSelectedId(null);setDeleteTarget(null);
    } catch(e) {setError((e as Error).message);setDeleteTarget(null);} finally {setDeleting(false);}
  }
  async function undoDelete() {
    if(!deleted||deleting)return;setDeleting(true);
    try{const restored=await api<CasePacket>(`cases/${deleted.id}/restore`,{});setDeleted(null);await refresh();setSelectedId(restored.id);}
    catch(e){setError((e as Error).message);}finally{setDeleting(false);}
  }
  if (authenticated === null && !error) return <main className="loading-screen" aria-busy="true">Opening your workspace…</main>;
  if (!authenticated) return <main className="login-screen">
    <div className="login-intro"><Brand /><h1>A clearer picture<br />before the first hello.</h1><p>A patient’s own words, the areas that matter, and an organized brief. All ready before the conversation.</p><div className="login-foot">Healthcare intake · Clinician workspace</div></div>
    <section className="login-panel"><form onSubmit={login}><h2>Welcome back</h2><p>Sign in to the demo clinician workspace.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={loading}>{loading ? 'Signing in…' : 'Open workspace'}</button><p className="demo-note">Demo account: doctor@demo.com / demo1234<br />Use demonstration data only.</p></form></section>
  </main>;
  return <div className="workspace">
    <header className="topbar"><Brand /><span className="workspace-title">Clinician workspace</span><div className="top-actions"><span className="demo-tag">Demo environment</span><button className="quiet" onClick={async () => { await api('auth/logout', {}); setAuthenticated(false); setCases([]); setSelectedId(null); }}>Sign out</button></div></header>
    {!!error && <div className="global-error" role="alert"><span>{error}</span><button className="quiet" onClick={() => void refresh()}>Retry</button></div>}
    {deleted && <div className="delete-notice" role="status"><span>Case deleted from the active history.</span><button ref={undoDeleteRef} className="quiet" disabled={deleting} onClick={()=>void undoDelete()}>Undo deletion</button></div>}
    <main className="desk">
      <aside className={`case-sidebar ${selected ? 'has-selection' : ''}`}><div className="list-heading"><div><h1>Patient intakes</h1><p>{cases.length} case{cases.length !== 1 ? 's' : ''} · newest first</p></div><button className="quiet" disabled={loading} onClick={() => void refresh()}>{loading ? 'Loading…' : 'Refresh'}</button></div>
        <label className="search-label"><span className="sr-only">Search cases</span><input type="search" placeholder="Search symptoms or specialty" value={filter} onChange={e => setFilter(e.target.value)} /></label>
        <div className="case-list">{visible.map(p => <button className={`case-row ${selectedId === p.id ? 'active' : ''}`} key={p.id} onClick={() => { setSelectedId(p.id); setError(''); }}>
          <div className="row-top"><span className="patient-avatar">DP</span><div><strong>Demo patient</strong><span>{date(p.createdAt)}</span></div><Urgency packet={p} /></div><p className="case-excerpt">{p.symptoms}</p><div className="row-bottom"><span>{p.assessment?.specialty || 'Awaiting assessment'}</span><span>{p.status === 'complete' ? 'Ready to review' : 'Intake in progress'}</span></div>
        </button>)}{visible.length === 0 && <div className="empty"><h3>{filter ? 'No matching intakes' : 'No intakes yet'}</h3><p>{filter ? 'Try a different symptom or specialty.' : 'Start a case in the patient app. It will appear here as soon as it is saved.'}</p>{filter && <button className="quiet" onClick={() => setFilter('')}>Clear search</button>}</div>}</div>
        <div className="sidebar-foot">One packet. A more informed conversation.<br />{DISCLAIMER}</div>
      </aside>
      <section className="case-content" aria-label="Case detail">

        {!selected ? <div className="welcome-empty"><span className="packet-mark" aria-hidden="true"><svg width="52" height="60" viewBox="0 0 52 60" fill="none"><rect x="7" y="4" width="38" height="52" rx="5" stroke="currentColor" strokeWidth="2"/><path d="M17 21h18M17 30h18M17 39h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span><h2>Ready when your patient is.</h2><p>Select an intake to see symptoms, photos, the AI brief, and notes together.</p></div> : <>
          <button className="quiet mobile-back" onClick={() => setSelectedId(null)}>Back to intakes</button>
          <div className="packet-actions"><button type="button" className="quiet delete-case" onClick={()=>setDeleteTarget(selected)}>Delete case</button></div>
          <div className="packet-header"><div><p className="case-reference">Case {selected.id.slice(0, 8)} · {date(selected.createdAt)}</p><h2>Demo patient</h2><p>{selected.assessment?.specialty || 'Assessment pending'} <span className="separator">/</span> {selected.regions.length} reported area{selected.regions.length !== 1 ? 's' : ''}</p></div><Urgency packet={selected} large /></div>
          {selected.assessment?.source === 'demo' && <div className="demo-banner">Demonstration output. Images were not analyzed; the urgency value is a fixed placeholder.</div>}
          {selected.assessment && selected.assessment.source !== 'demo' && selected.assessment.urgency >= 8 && <div className="urgent-banner"><strong>Prompt clinician contact recommended</strong><p>{selected.assessment.urgencyReason}</p><p>{EMERGENCY_MESSAGE}</p></div>}
          <div className="vitals-strip"><Metric label="Height" value={`${selected.heightCm} cm`} /><Metric label="Weight" value={`${selected.weightKg} kg`} /><Metric label="Anatomical model" value={selected.sex} /><Metric label="View preset" value={selected.pose.replace('-', ' ')} /></div>
          <section className="packet-section"><h3>In the patient’s words</h3><blockquote>{selected.symptoms}</blockquote></section>
          <section className="packet-section"><div className="section-title"><h3>Professional assessment</h3><span className="small-tag">{selected.assessment?.source === 'demo' ? 'Demo brief' : 'AI decision support'}</span></div>{selected.assessment ? <><p className="assessment-text">{selected.assessment.professionalAssessment}</p><p className="urgency-explanation"><strong>Estimated urgency {selected.assessment.urgency}/10.</strong> {selected.assessment.urgencyReason}</p><details><summary>Patient-friendly summary</summary><p>{selected.assessment.patientSummary}</p></details><h4>Suggested next steps</h4><ul>{selected.assessment.nextSteps.map(s => <li key={s}>{s}</li>)}</ul><details className="assessment-limitations"><summary>Limitations and context</summary><p className="disclaimer">{selected.assessment.limitations.join(' ')}</p></details></> : <p className="muted">The patient is still completing intake. An assessment will appear after submission.</p>}</section>
          {!!selected.photoReview?.questions.length && <section className="packet-section"><h3>Photo follow-up</h3>{selected.photoReview.source === 'demo' && <p className="muted">Demo questions · images were not analyzed.</p>}{selected.photoReview.questions.map(q => <div key={q.id}><h4>{q.prompt}</h4><p>{q.answer || 'Not answered'}</p></div>)}</section>}
          <section className="packet-section"><h3>Symptom map</h3><p className="muted">Patient-reported intensity, separate from AI urgency.</p><CaseHeatmap packet={selected}/><div className="region-table">{selected.regions.map(r => <div className="region-row" key={r.regionId}><span>{regionLabel(r.regionId)}</span><div className="intensity-track"><div style={{ width: `${r.intensity * 10}%`, background:'#555555' }} /></div><strong>{r.intensity}<small>/10</small></strong></div>)}</div></section>
          <section className="packet-section"><h3>Photos by area <span className="count">{selected.photos.length}</span></h3>{selected.photos.length ? <div className="photo-grid">{selected.photos.map(p => <button key={p.id} className="photo-item" onClick={() => setPreview(p.id)}><img src={`/api/photos/${p.id}`} alt={`Patient photo: ${regionLabel(p.regionId)}`} loading="lazy" /><span>{regionLabel(p.regionId)}</span></button>)}</div> : <p className="muted">No photos attached. A lack of visible findings does not rule out a medical problem.</p>}</section>
          <section className="packet-section"><h3>Clinical notes</h3><p className="muted">Notes become part of the patient’s case history.</p><div className="notes">{selected.annotations.map(n => <article className="note" key={n.id}><div><strong>{n.doctor}</strong><time>{date(n.createdAt)}</time></div><p>{n.text}</p></article>)}{!selected.annotations.length && <p className="muted">No notes yet.</p>}</div><form onSubmit={saveNote} className="note-form"><label htmlFor="clinical-note">Add a note</label><textarea id="clinical-note" rows={4} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder="Your observations, follow-up or care context…" required /><div><span className="muted">{note.length}/4000</span><button disabled={!note.trim() || saving}>{saving ? 'Saving…' : 'Save clinical note'}</button></div>{notice && <p className="success" role="status">{notice}</p>}</form></section>
          <section className="packet-section"><h3>Patient history</h3><div className="history-table">{cases.filter(p => p.status === 'complete').map(p => <button key={p.id} className="history-row" onClick={() => setSelectedId(p.id)}><span>{new Date(p.createdAt).toLocaleDateString('en-US')}</span><span>{p.weightKg} kg · {p.heightCm} cm</span><span>{p.assessment?.specialty}</span></button>)}</div></section>
        </>}
      </section>
    </main>
    {preview && <dialog ref={dialogRef} className="image-modal" aria-label="Patient photo preview" onCancel={() => setPreview(null)} onClick={e => { if (e.target === e.currentTarget) setPreview(null); }}><button autoFocus onClick={() => setPreview(null)}>Close photo</button><img src={`/api/photos/${preview}`} alt="Expanded patient photo" /></dialog>}
    {deleteTarget&&<dialog ref={deleteDialogRef} className="delete-dialog" aria-labelledby="delete-title" onCancel={e=>{if(deleting)e.preventDefault();else setDeleteTarget(null);}}><h2 id="delete-title">Delete this case?</h2><p>It will be removed from the clinician dashboard and patient history. You can undo this after deletion.</p><p className="muted">Case {deleteTarget.id.slice(0,8)} · {date(deleteTarget.createdAt)}</p><div className="dialog-actions"><button autoFocus type="button" className="quiet" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Keep case</button><button type="button" disabled={deleting} onClick={()=>void deleteSelected()}>{deleting?'Deleting…':'Delete case'}</button></div></dialog>}
  </div>;
}
function Brand() { return <div className="brand"><svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="8" fill="currentColor"/><path d="M14 7v14M7 14h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg><span>intake</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Urgency({ packet, large }: { packet: CasePacket; large?: boolean }) {
  const a = packet.assessment;
  return <span className={`urgency ${large ? 'large' : ''} ${a?.source === 'demo' ? 'demo' : a && a.urgency >= 8 ? 'high' : ''}`}>{a ? <>{large && <span>{a.source === 'demo' ? 'Demo urgency' : 'AI-estimated urgency'}</span>}<strong>{a.urgency}<small>/10</small></strong>{!large && a.source === 'demo' && <small>demo</small>}</> : <span>Draft</span>}</span>;
}
