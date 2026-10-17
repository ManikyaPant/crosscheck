"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCheck, Copy, FileAudio, Globe2, Mic, Plus, RotateCcw, ShieldCheck, Square, Upload, X } from "lucide-react";
import type { Comparison, Statement } from "../lib/types";

type Input = Statement & { file: File | null; url: string };
const empty = (): Input => ({ original: "", english: "", language: "unknown", file: null, url: "" });
const languages = [["unknown","Auto-detect"],["hi-IN","Hindi"],["en-IN","English"],["ta-IN","Tamil"],["bn-IN","Bengali"],["te-IN","Telugu"],["mr-IN","Marathi"],["kn-IN","Kannada"],["gu-IN","Gujarati"],["ml-IN","Malayalam"],["pa-IN","Punjabi"],["ur-IN","Urdu"]];
const examples = [
  { label: "A meeting, two times", tag: "Hindi + English", a: "मीटिंग कल दोपहर 2 बजे है।", b: "The meeting is tomorrow at 4 PM.", language: "hi-IN" },
  { label: "A difference in price", tag: "English", a: "The total project price is 5,000 rupees, including delivery.", b: "The total project price is 8,000 rupees, including delivery.", language: "en-IN" },
  { label: "Same meaning?", tag: "Hindi + English", a: "दो टिकट की कुल कीमत पांच हजार रुपये है।", b: "The total price of two tickets is 5,000 rupees.", language: "hi-IN" },
];
function Highlight({ text, quotes }: { text: string; quotes: string[] }) {
  const spans = quotes.flatMap(quote => {
    if (!quote) return [];
    const start = text.indexOf(quote); return start < 0 ? [] : [{ start, end: start + quote.length }];
  }).sort((a,b) => a.start - b.start);
  const parts: React.ReactNode[] = []; let cursor = 0;
  for (const span of spans) { if (span.start < cursor) continue; parts.push(text.slice(cursor, span.start), <mark key={span.start}>{text.slice(span.start, span.end)}</mark>); cursor = span.end; }
  parts.push(text.slice(cursor)); return <>{parts}</>;
}
function Capture({ side, value, disabled, consent, change, error, recordingChanged }: {
  side: "a"|"b"; value: Input; disabled: boolean; consent: boolean;
  change: (next: Partial<Input>) => void; error: (message: string) => void; recordingChanged: (active: boolean) => void;
}) {
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearInterval(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function record() {
    if (!consent) { error("Please confirm recording and processing consent below first."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { error("Recording isn't available in this browser. Upload an audio file or type the statements."); return; }
    try {
      recordingChanged(true);
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined); recorder.current = r;
      const chunks: BlobPart[] = []; r.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      r.onstop = () => {
        if (timer.current) clearInterval(timer.current); stream.current?.getTracks().forEach(t => t.stop());
        if (!alive.current) return;
        setRecording(false); recordingChanged(false);
        const type = r.mimeType || "audio/webm";
        const file = new File(chunks, `statement_${side}.${type.includes("mp4") ? "m4a" : "webm"}`, { type });
        if (file.size) change({ file, url: URL.createObjectURL(file), original: "", english: "" });
        else error("No audio was captured. Please try again.");
      };
      setSeconds(0); setRecording(true); r.start(); let elapsed = 0;
      timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 29 && r.state === "recording") r.stop(); }, 1000);
    } catch { stream.current?.getTracks().forEach(t => t.stop()); recordingChanged(false); error("Microphone access wasn't granted. Allow it in your browser, or upload a file."); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!/\.(wav|mp3|m4a|mp4|webm|ogg|oga|opus|flac|aac|aiff|aif|amr|wma)$/i.test(file.name)) { error("Please choose a supported audio file, such as WAV, MP3, M4A, WebM or OGG."); return; }
    if (!file.size || file.size > 2 * 1024 * 1024) { error("Choose a non-empty audio file of 2 MB or less."); return; }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error()), 8000);
        audio.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
        audio.onerror = () => { clearTimeout(timeout); reject(new Error()); };
      });
      if (Number.isFinite(audio.duration) && audio.duration > 30) { URL.revokeObjectURL(url); error("This clip is longer than 30 seconds. Trim it before uploading."); return; }
    } catch { /* Sarvam validates formats that the browser cannot decode. */ }
    finally { audio.removeAttribute("src"); audio.load(); }
    change({ file, url, original: "", english: "" });
  }
  return <article className={`statement statement-${side}`}>
    <div className="card-heading"><span className={`avatar ${side}`}>{side.toUpperCase()}</span><div><h2>Statement {side.toUpperCase()}</h2><span>{side === "a" ? "The first perspective" : "The other perspective"}</span></div><select aria-label={`Language for statement ${side.toUpperCase()}`} value={value.language} disabled={disabled} onChange={e => change({ language: e.target.value })}>{languages.map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select></div>
    <div className="capture">
      {recording ? <><div className="recording-dot"/><strong>Recording · 00:{String(seconds).padStart(2,"0")}</strong><button className="small danger" onClick={() => recorder.current?.stop()}><Square size={14}/> Stop</button></> : value.file ? <><FileAudio size={23}/><span className="filename">{value.file.name}</span><button className="icon-button" aria-label={`Remove statement ${side} audio`} disabled={disabled} onClick={() => change({file:null,url:""})}><X size={17}/></button></> : <><button className="record-button" disabled={disabled} onClick={record}><Mic size={18}/> Record audio</button><span className="or">or</span><label className={`upload-button ${disabled ? "disabled" : ""}`}><Upload size={16}/> Upload a file<input type="file" accept=".wav,.mp3,.m4a,.mp4,.webm,.ogg,.opus,.flac,.aac,.aiff,.amr,.wma" disabled={disabled} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }}/></label></>}
    </div>
    {value.url && <audio controls src={value.url} className="audio-player"/>}
    <label className="text-label" htmlFor={`text-${side}`}>{value.file ? "Transcript appears after comparison" : "Or type a statement"}<span>{value.original.length}/12,000</span></label>
    <textarea id={`text-${side}`} placeholder={side === "a" ? "What did the first person say?" : "What did the other person say?"} value={value.original} maxLength={12000} disabled={disabled || Boolean(value.file)} onChange={e => change({original:e.target.value,english:""})}/>
    {value.english && value.english !== value.original && <label className="translation">English translation<textarea aria-label={`English translation of statement ${side}`} value={value.english} disabled={disabled} maxLength={12000} onChange={e => change({english:e.target.value})}/></label>}
    <div className="card-footer"><span><Globe2 size={13}/> Any supported language</span><span>30 sec max · 2 MB</span></div>
  </article>;
}
export default function Home() {
  const [inputs,setInputs] = useState<{a:Input;b:Input}>({a:empty(),b:empty()});
  const [consent,setConsent] = useState(false); const [topic,setTopic] = useState("");
  const [busy,setBusy] = useState(false); const [recording,setRecording] = useState(false);
  const [result,setResult] = useState<Comparison|null>(null); const [error,setError] = useState("");
  const [progress,setProgress] = useState(""); const [configured,setConfigured] = useState<boolean|null>(null);
  const [copied,setCopied] = useState(""); const urls = useRef(new Set<string>());
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => { fetch("/api/health").then(r=>r.json() as Promise<{configured:boolean}>).then(d=>setConfigured(Boolean(d.configured))).catch(()=>setConfigured(false)); return () => { urls.current.forEach(url=>URL.revokeObjectURL(url)); }; },[]);
  function change(side:"a"|"b",next:Partial<Input>) {
    if (next.url) urls.current.add(next.url);
    setInputs(prev=> { if (next.url !== undefined && prev[side].url) {URL.revokeObjectURL(prev[side].url); urls.current.delete(prev[side].url);} return {...prev,[side]:{...prev[side],...next}}; });
    setError(""); setResult(null);
  }
  function reset() { urls.current.forEach(url=>URL.revokeObjectURL(url)); urls.current.clear(); setInputs({a:empty(),b:empty()}); setResult(null); setError(""); setTopic(""); }
  function sample(index:number) { reset(); const ex=examples[index]; setInputs({a:{...empty(),original:ex.a,language:ex.language},b:{...empty(),original:ex.b,language:"en-IN"}}); }
  async function compare() {
    setBusy(true); setError(""); setResult(null); setProgress("Preparing statements…");
    try {
      const hasAudio=Boolean(inputs.a.file || inputs.b.file); let body: BodyInit;
      const headers:Record<string,string>={Accept:"application/x-ndjson"};
      const statement=(s:Input)=>({original:s.original,english:s.english,language:s.language});
      if (hasAudio) {const form=new FormData(); for(const side of ["a","b"] as const) { const s=inputs[side]; if(s.file)form.append(`audio_${side}`,s.file); else form.append(`text_${side}`,JSON.stringify(statement(s))); form.append(`language_${side}`,s.language); } form.append("topic",topic); form.append("consent",String(consent)); body=form;}
      else {headers["Content-Type"]="application/json";body=JSON.stringify({a:statement(inputs.a),b:statement(inputs.b),topic});}
      const response=await fetch("/api/compare",{method:"POST",headers,body});
      if(!response.ok) {const data=await response.json() as {error?:string};throw new Error(data.error || "Comparison failed. Please try again.");}
      const reader=response.body?.getReader(); if(!reader)throw new Error("The server returned an empty response.");
      const decoder=new TextDecoder(); let buffer="", completed=false;
      function event(line:string) {if(!line.trim())return;const e=JSON.parse(line);if(e.kind==="error")throw new Error(e.error);if(e.kind==="progress")setProgress(`${e.statement ? `Statement ${e.statement.toUpperCase()}: `:""}${e.stage}…`);if(e.kind==="transcript")setInputs(prev=>({...prev,[e.statement]:{...prev[e.statement as "a"|"b"],...e.data}}));if(e.kind==="result"){setResult(e.data);completed=true;setInputs(prev=>({a:{...prev.a,...e.data.statements.a,file:null},b:{...prev.b,...e.data.statements.b,file:null}}));}}
      while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split("\n");buffer=lines.pop()||"";lines.forEach(event);if(done)break;}event(buffer);
      if(!completed)throw new Error("The comparison was interrupted. Please try again.");
      setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
    } catch(e) {setError(e instanceof Error?e.message:"Comparison failed. Please try again.");}
    finally {setBusy(false);setProgress("");}
  }
  async function copy(id:string,text:string){try{await navigator.clipboard.writeText(text);setCopied(id);setTimeout(()=>setCopied(""),2000);}catch{setError("Clipboard access was blocked. Select the question and copy it manually.");}}
  const ready = [inputs.a,inputs.b].every(s=>s.file || s.original.trim());
  const needsConsent=Boolean(inputs.a.file || inputs.b.file);
  return <div className="app-shell">
    <header className="topbar"><a href="/" className="brand"><span className="brand-mark"><CheckCheck size={22}/></span>CrossCheck<span className="demo-badge">DEMO</span></a><span className={`connection ${configured ? "connected":""}`}><i/>{configured===null?"Checking connection":configured?"Sarvam connected":"API key not configured"}</span></header>
    <main>
      <section className="intro"><div className="eyebrow"><span/> DIFFERENT WORDS. SHARED UNDERSTANDING.</div><h1>Two stories.<br/><em>One clearer picture.</em></h1><p>Find the contradictions between two statements, even across languages.<br className="desktop"/> Turn a difference of opinion into the right question.</p><div className="intro-tags"><span><Globe2 size={14}/> Built for Indian languages</span><span><ShieldCheck size={14}/> No saved recordings</span></div></section>
      <section className="workspace"><div className="section-heading"><div><span className="step-number">01</span><h2>Bring both perspectives</h2></div><button className="text-button" onClick={reset} disabled={busy||recording}><RotateCcw size={14}/> Start fresh</button></div>
        <div className="statements">{(["a","b"] as const).map(side=><Capture key={side} side={side} value={inputs[side]} disabled={busy||recording} consent={consent} recordingChanged={setRecording} change={next=>change(side,next)} error={setError}/>) }<span className="between"><Plus size={17}/></span></div>
        <div className="context"><label htmlFor="topic">A little context <span>(optional)</span></label><input id="topic" maxLength={500} disabled={busy||recording} placeholder="e.g. Tomorrow’s project meeting" value={topic} onChange={e=>{setTopic(e.target.value);setResult(null);}}/></div>
        <label className="consent"><input type="checkbox" checked={consent} disabled={busy||recording} onChange={e=>setConsent(e.target.checked)}/><span>I have consent to record these speakers and send their audio to Sarvam for processing.</span></label>
        {error&&<div className="error" role="alert">{error}</div>}
        <div className="compare-row"><p>{busy?<span role="status">{progress}</span>:"We compare what was said, not who is right."}</p><button className="primary" disabled={!ready||busy||recording||(needsConsent&&!consent)} onClick={compare}>{busy?<><span className="spinner"/> Comparing…</>:<>{result?"Compare again":"Find the differences"}<ArrowRight size={17}/></>}</button></div>
      </section>
      {result&&<section className="results" ref={resultRef} aria-label="Comparison results"><div className="section-heading"><div><span className="step-number">02</span><h2>A clearer picture</h2></div><span className={`result-label ${result.degraded?"uncertain":""}`}>{result.degraded?"Review needed":`${result.conflicts.length} ${result.conflicts.length===1?"conflict":"conflicts"} found`}</span></div><p className="summary">{result.summary}</p>
        {!result.degraded&&<div className="evidence">{(["a","b"] as const).map(side=><div key={side}><span className="eyebrow">STATEMENT {side.toUpperCase()} · {result.statements[side].language}</span><p><Highlight text={result.statements[side].original} quotes={result.conflicts.map(c=>side==="a"?c.statement_a.quote:c.statement_b.quote)}/></p>{result.statements[side].english!==result.statements[side].original&&<small>{result.statements[side].english}</small>}</div>)}</div>}
        {result.conflicts.map((c,index)=><article className="conflict" key={c.id}><div className="conflict-heading"><span className="conflict-index">{String(index+1).padStart(2,"0")}</span><h3>{c.topic}</h3><span className={`severity ${c.severity}`}>{c.severity} severity</span><span className="type-tag">{c.type}</span></div><div className="values"><div><span>STATEMENT A</span><strong>{c.statement_a.normalized}</strong></div><span className="versus">vs</span><div><span>STATEMENT B</span><strong>{c.statement_b.normalized}</strong></div></div><p>{c.explanation}</p><div className="question"><div><span>ASK TO CLARIFY</span><p>{c.clarification_question}</p></div><button className="icon-button" aria-label="Copy clarification question" onClick={()=>copy(c.id,c.clarification_question)}>{copied===c.id?<Check size={17}/>:<Copy size={17}/>}</button></div><small className="confidence">Model confidence: {Math.round(c.confidence*100)}% · estimate, not a calibrated score</small></article>)}
        {!result.degraded&&result.conflicts.length===0&&<div className="all-clear"><CheckCheck size={24}/><div><h3>No direct contradiction found</h3><p>Review the agreements and any details mentioned by only one person below.</p></div></div>}
        <div className="coverage"><div><h3><Check size={16}/> On the same page</h3>{result.agreements.length?result.agreements.map((a,i)=><p key={i}><strong>{a.topic}</strong><span>{a.value}</span></p>):<small>No explicit agreements identified.</small>}</div><div><h3><Plus size={16}/> Said by just one person</h3>{result.unaddressed.length?result.unaddressed.map((u,i)=><p key={i}><strong>{u.topic} · {u.statement}</strong><span>{u.value}</span></p>):<small>No one-sided details identified.</small>}</div></div><p className="edit-note">Transcription mistake? Edit the statements above and compare again without re-recording.</p>
      </section>}
      <section className="examples"><div><span className="eyebrow">NEED A STARTING POINT?</span><h2>Small details. Big differences.</h2><p>Load an example, then compare it live with Sarvam.</p></div><div className="example-list">{examples.map((ex,i)=><button key={ex.label} onClick={()=>sample(i)} disabled={busy||recording}><span className="example-number">0{i+1}</span><span><strong>{ex.label}</strong><small>{ex.tag}</small></span><ArrowRight size={17}/></button>)}</div></section>
      <footer><span className="brand footer-brand"><CheckCheck size={18}/>CrossCheck</span><span>A little clarity goes a long way.</span><span>Powered by Sarvam AI</span></footer>
    </main>
  </div>;
}
