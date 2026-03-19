/**
 * BrianMap v4 — stabile, zoom/pan, 2D vettoriale + 3D sfera
 * Fix: wheel passivo, niente gradient refs, rendering pulito
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';

// ─── Types ──────────────────────────────────────────────────────
type N = {
  id: string; label: string; sub?: string; icon: string;
  color: string; ring: 0|1|2|3|4|5; angle: number;
  lon: number; lat: number;
  cat: 'brain'|'core'|'provider'|'feature'|'tool'|'service';
  desc: string; items?: string[]; actions?: {label:string;win?:string}[];
  liveKey?: string;
};

const NODES: N[] = [
  { id:'brain',label:'BRAIN',sub:'OS Nervoso',icon:'🧠',color:'#ff4020',ring:0,angle:0,lon:0,lat:0,cat:'brain',
    desc:'Nucleo centrale. Riceve linguaggio naturale, orchestra tutta la rete IA.',
    items:['Intent: work|app|skill|general','callAIWithTools','System snapshot','Multi-provider routing'],
  },
  { id:'orchestrator',label:'Motore',sub:'Orchestratore',icon:'⚙️',color:'#fbbf24',ring:1,angle:0,lon:0,lat:70,cat:'core',
    desc:'Esegue grafi workflow nodo per nodo. Gestisce pause/resume/stop, workspace.',
    items:['executeProject()','executeNode()','SSE real-time','workspace_path detection'],
    actions:[{label:'Processi',win:'processes'}],
  },
  { id:'planner',label:'Planner',sub:'AI Workflow',icon:'🗺️',color:'#a78bfa',ring:1,angle:90,lon:90,lat:70,cat:'core',
    desc:'Traduce NL in grafi workflow. Ottimizza, inietta skill e connectors.',
    items:['sendChatMessage()','isProjectBuildIntent()','getConnectorsContext()'],
    actions:[{label:'Work',win:'work'}],
  },
  { id:'memory_sys',label:'Memoria',sub:'Persistente',icon:'🧬',color:'#818cf8',ring:1,angle:180,lon:180,lat:70,cat:'core',
    desc:'Memoria FTS + vettoriale. Contesto persistente tra sessioni.',
    items:['memory_save / memory_search','FTS SQLite','Context injection auto'],
  },
  { id:'filesystem',label:'File OS',sub:'~/FLOW/',icon:'📂',color:'#34d399',ring:1,angle:270,lon:270,lat:70,cat:'core',
    desc:'File system OS ~/Documents/FLOW/ indicizzato per AI.',
    items:['Apps/ Documents/ Work/ Media/','flow_files DB + FTS'],
    actions:[{label:'Files',win:'files'}],
  },
  { id:'openai',label:'OpenAI',sub:'GPT-4o',icon:'⊙',color:'#10b981',ring:2,angle:0,lon:0,lat:40,cat:'provider',
    desc:'OpenAI GPT-4o, o1, o3. Provider principale.',
    items:['GPT-4o (default)','o1/o3 ragionamento','Function calling','Streaming'],
  },
  { id:'anthropic',label:'Anthropic',sub:'Claude',icon:'⊛',color:'#f97316',ring:2,angle:72,lon:72,lat:40,cat:'provider',
    desc:'Claude Sonnet/Opus/Haiku. Testo lungo, analisi, codice.',
    items:['Claude Sonnet 4.6','Opus 4.6','Haiku 4.5','Vision'],
  },
  { id:'gemini',label:'Gemini',sub:'2.5 Flash',icon:'⊟',color:'#3b82f6',ring:2,angle:144,lon:144,lat:40,cat:'provider',
    desc:'Google Gemini 2.0/2.5. 1M token context, multimodale.',
    items:['Gemini 2.5 Flash/Pro','2.0 Flash','1M token'],
  },
  { id:'ollama',label:'Ollama',sub:'Locale',icon:'⊠',color:'#84cc16',ring:2,angle:216,lon:216,lat:40,cat:'provider',
    desc:'Modelli locali Ollama. Nessun dato al cloud.',
    items:['LLaMA 3.2 Vision','DeepSeek R1','Qwen 2.5'],
  },
  { id:'custom_prov',label:'Custom AI',sub:'OpenAI-compat',icon:'⊞',color:'#ec4899',ring:2,angle:288,lon:288,lat:40,cat:'provider',
    desc:'Provider custom OpenAI-compatible.',
    items:['Base URL custom','API key','Model list auto'],
    actions:[{label:'Settings',win:'settings'}],
  },
  { id:'flow_chat',label:'FLOW Chat',sub:'Superbrain',icon:'⚡',color:'#ff4020',ring:3,angle:0,lon:0,lat:15,cat:'feature',
    desc:'Chat principale. Qualsiasi richiesta → work, app, skill, web, file.',
    items:['Intent detection','Crea progetti + work','Installa skill','Tool access completo'],
    actions:[{label:'FLOW',win:'flow'}],
  },
  { id:'work_engine',label:'Work',sub:'Workflow',icon:'🗂️',color:'#e84020',ring:3,angle:36,lon:36,lat:15,cat:'feature',
    desc:'Workflow visivi a nodi. Chat → grafo → esecuzione.',
    items:['Grafo D3/React','Nodi: sorgente/analisi/exec','SSE progress','Output'],
    actions:[{label:'Work',win:'work'}],
  },
  { id:'app_builder',label:'Builder',sub:'Web App',icon:'🏗️',color:'#f97316',ring:3,angle:72,lon:72,lat:15,cat:'feature',
    desc:'Builder 6-step. Wizard → planner → codice React → app live.',
    items:['6-step wizard','npm/vite auto','Dev server 44xxx','iframe preview'],
    actions:[{label:'Builder',win:'builder'}],
  },
  { id:'agents_sys',label:'Agenti',sub:'Autonomi',icon:'👥',color:'#ec4899',ring:3,angle:108,lon:108,lat:15,cat:'feature',
    desc:'Agenti autonomi specializzati. Multi-provider, tools per ruolo.',
    items:['Specializzati per ruolo','Session model override','Orchestrazione parallela'],
    actions:[{label:'Agenti',win:'agenti'}],
    liveKey:'agents',
  },
  { id:'skills_lib',label:'Skills',sub:'Capacità',icon:'⭐',color:'#eab308',ring:3,angle:144,lon:144,lat:15,cat:'feature',
    desc:'Skill auto-iniettate nel contesto AI. Creabili da FLOW.',
    items:['Auto-inject contesto','installSkill() da chat','FTS matching'],
    liveKey:'skills',
  },
  { id:'connectors',label:'Connectors',sub:'Integrazioni',icon:'🔌',color:'#06b6d4',ring:3,angle:180,lon:180,lat:15,cat:'feature',
    desc:'Hub integrazioni. Disponibili ovunque nel sistema.',
    items:['Telegram, Gmail, Slack','Webhook, GitHub','Contesto auto AI'],
    actions:[{label:'Connettori',win:'connettori'}],
  },
  { id:'scheduler',label:'Scheduler',sub:'Cron',icon:'⏰',color:'#84cc16',ring:3,angle:216,lon:216,lat:15,cat:'feature',
    desc:'Cron engine. Esegue workflow automaticamente.',
    items:['Cron expressions','Trigger connector events','Run workflow auto'],
  },
  { id:'browser_ai',label:'Browser',sub:'Web',icon:'🌐',color:'#60a5fa',ring:3,angle:252,lon:252,lat:15,cat:'feature',
    desc:'Browser launcher + fetch AI. Apre Chrome, estrae contenuto per IA.',
    items:['Apre Chrome/browser esterno','Fetch testo per AI','/browser/fetch API'],
    actions:[{label:'Browser',win:'browser'}],
  },
  { id:'knowledge',label:'Knowledge',sub:'Vettoriale',icon:'📚',color:'#c084fc',ring:3,angle:288,lon:288,lat:15,cat:'feature',
    desc:'Knowledge base. FTS, ricerca semantica, learning.',
    items:['FTS SQLite','JSON store','Context injection'],
  },
  { id:'realtime',label:'Real-time',sub:'WebSocket',icon:'📡',color:'#34d399',ring:3,angle:324,lon:324,lat:15,cat:'feature',
    desc:'SSE + WebSocket. Live events esecuzione e connectors.',
    items:['SSE /projects/:id/events','WS live build','Connector events'],
  },
  { id:'web_search',label:'web_search',icon:'🔍',color:'#64748b',ring:4,angle:0,lon:0,lat:-20,cat:'tool',desc:'Ricerca web real-time.',items:['Google/DDG','Snippet + URL']},
  { id:'http_request',label:'http_req',icon:'🌍',color:'#64748b',ring:4,angle:26,lon:26,lat:-20,cat:'tool',desc:'HTTP GET/POST a qualsiasi API.',items:['Headers/body','Auth Bearer']},
  { id:'code_exec',label:'code_exec',icon:'💻',color:'#7dd3fc',ring:4,angle:51,lon:51,lat:-20,cat:'tool',desc:'Esegue JS in sandbox.',items:['Sandbox sicura','10s timeout']},
  { id:'parse_doc',label:'parse_doc',icon:'📄',color:'#64748b',ring:4,angle:77,lon:77,lat:-20,cat:'tool',desc:'Estrae testo da PDF, DOCX, Excel, OCR.',items:['PDF/DOCX/CSV','OCR immagini']},
  { id:'write_file',label:'write_file',icon:'✏️',color:'#86efac',ring:4,angle:103,lon:103,lat:-20,cat:'tool',desc:'Scrive file nel FS.',items:['Crea dir auto','UTF-8']},
  { id:'read_file',label:'read_file',icon:'📖',color:'#86efac',ring:4,angle:128,lon:128,lat:-20,cat:'tool',desc:'Legge file dal FS.',items:['Testo/binario']},
  { id:'bash_exec',label:'bash_exec',icon:'⌨️',color:'#fca5a5',ring:4,angle:154,lon:154,lat:-20,cat:'tool',desc:'Comandi bash. npm, git, build.',items:['Shell bash','60s timeout']},
  { id:'img_gen',label:'img_gen',icon:'🎨',color:'#f9a8d4',ring:4,angle:180,lon:180,lat:-20,cat:'tool',desc:'Genera immagini. DALL-E 3.',items:['DALL-E 3','size/style config']},
  { id:'send_email',label:'send_email',icon:'📧',color:'#64748b',ring:4,angle:205,lon:205,lat:-20,cat:'tool',desc:'Invia email via Gmail/SMTP.',items:['HTML body','Via connector']},
  { id:'screenshot',label:'screenshot',icon:'📸',color:'#64748b',ring:4,angle:231,lon:231,lat:-20,cat:'tool',desc:'Screenshot URL via Puppeteer.',items:['Full page','Base64']},
  { id:'translate',label:'translate',icon:'🌏',color:'#64748b',ring:4,angle:257,lon:257,lat:-20,cat:'tool',desc:'Traduzione 100+ lingue.',items:['Auto-detect source']},
  { id:'gen_code',label:'gen_code',icon:'🤖',color:'#7dd3fc',ring:4,angle:282,lon:282,lat:-20,cat:'tool',desc:'Genera codice sorgente da spec.',items:['React/Vue/Node/Python']},
  { id:'save_mem',label:'save_mem',icon:'💾',color:'#a5b4fc',ring:4,angle:308,lon:308,lat:-20,cat:'tool',desc:'Salva in memoria persistente.',items:['FTS','Cross-session']},
  { id:'run_workflow',label:'run_wf',icon:'▶️',color:'#6ee7b7',ring:4,angle:334,lon:334,lat:-20,cat:'tool',desc:'Avvia workflow background.',items:['By project ID','Async']},
  { id:'telegram_svc',label:'Telegram',icon:'✈️',color:'#38bdf8',ring:5,angle:0,lon:0,lat:-52,cat:'service',desc:'Bot Telegram da workflow.',items:['sendMessage','Bot commands']},
  { id:'gmail_svc',label:'Gmail',icon:'📬',color:'#f87171',ring:5,angle:45,lon:45,lat:-52,cat:'service',desc:'Gmail da workflow.',items:['sendMail()','readInbox()']},
  { id:'slack_svc',label:'Slack',icon:'🔔',color:'#a78bfa',ring:5,angle:90,lon:90,lat:-52,cat:'service',desc:'Slack workspace.',items:['postMessage()','uploadFile()']},
  { id:'webhook_svc',label:'Webhook',icon:'⚡',color:'#fbbf24',ring:5,angle:135,lon:135,lat:-52,cat:'service',desc:'Receiver webhook, trigger workflow.',items:['POST /connectors/:id/webhook']},
  { id:'github_svc',label:'GitHub',icon:'🐙',color:'#e2e8f0',ring:5,angle:180,lon:180,lat:-52,cat:'service',desc:'GitHub API. Issues, PR, commit.',items:['Issues/PR','Commit files']},
  { id:'live_apps',label:'Live Apps',icon:'📱',color:'#4ade80',ring:5,angle:225,lon:225,lat:-52,cat:'service',desc:'App live create dal Builder.',items:['Dev server 44xxx','iframe preview'],actions:[{label:'App Gallery',win:'app-gallery'}],liveKey:'apps'},
  { id:'outputs',label:'Outputs',icon:'📊',color:'#fb923c',ring:5,angle:270,lon:270,lat:-52,cat:'service',desc:'Output workflow/agenti.',actions:[{label:'Outputs',win:'risultati'}]},
  { id:'timeline',label:'Timeline',icon:'📅',color:'#a3e635',ring:5,angle:315,lon:315,lat:-52,cat:'service',desc:'Storico esecuzioni.',actions:[{label:'Timeline',win:'timeline'}]},
];

const CONNS: [string,string][] = [
  ['brain','orchestrator'],['brain','planner'],['brain','memory_sys'],['brain','filesystem'],
  ['orchestrator','planner'],['planner','memory_sys'],
  ['orchestrator','openai'],['orchestrator','anthropic'],['orchestrator','gemini'],['orchestrator','ollama'],
  ['planner','openai'],['planner','anthropic'],['planner','gemini'],
  ['orchestrator','work_engine'],['orchestrator','app_builder'],['orchestrator','realtime'],
  ['planner','flow_chat'],['planner','work_engine'],['planner','app_builder'],['planner','skills_lib'],
  ['memory_sys','knowledge'],['memory_sys','flow_chat'],['memory_sys','agents_sys'],
  ['filesystem','app_builder'],['filesystem','flow_chat'],
  ['openai','flow_chat'],['openai','work_engine'],['openai','app_builder'],['openai','agents_sys'],
  ['anthropic','flow_chat'],['anthropic','work_engine'],['anthropic','app_builder'],
  ['gemini','flow_chat'],['gemini','agents_sys'],
  ['ollama','flow_chat'],['ollama','agents_sys'],['custom_prov','flow_chat'],
  ['flow_chat','web_search'],['flow_chat','http_request'],['flow_chat','code_exec'],
  ['flow_chat','parse_doc'],['flow_chat','write_file'],['flow_chat','save_mem'],['flow_chat','gen_code'],
  ['flow_chat','agents_sys'],['flow_chat','skills_lib'],['flow_chat','connectors'],
  ['work_engine','code_exec'],['work_engine','bash_exec'],['work_engine','run_workflow'],
  ['work_engine','send_email'],['work_engine','translate'],['work_engine','img_gen'],
  ['work_engine','outputs'],['work_engine','timeline'],
  ['app_builder','code_exec'],['app_builder','bash_exec'],['app_builder','write_file'],
  ['app_builder','gen_code'],['app_builder','live_apps'],
  ['agents_sys','web_search'],['agents_sys','http_request'],['agents_sys','screenshot'],
  ['agents_sys','translate'],['agents_sys','save_mem'],
  ['browser_ai','web_search'],['browser_ai','http_request'],['browser_ai','screenshot'],
  ['knowledge','save_mem'],['memory_sys','save_mem'],
  ['connectors','telegram_svc'],['connectors','gmail_svc'],['connectors','slack_svc'],
  ['connectors','webhook_svc'],['connectors','github_svc'],
  ['scheduler','work_engine'],['scheduler','connectors'],['realtime','orchestrator'],
  ['send_email','gmail_svc'],
];

const RR = [0, 110, 200, 305, 415, 540];

function npos(n: N) {
  const r = RR[n.ring];
  const a = (n.angle - 90) * Math.PI / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}
function h2r(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
function sph(lon:number,lat:number,r:number,rx:number,ry:number):[number,number,number]{
  const lo=(lon*Math.PI/180)+ry, la=(lat*Math.PI/180)+rx;
  return [r*Math.cos(la)*Math.sin(lo), r*Math.sin(la), r*Math.cos(la)*Math.cos(lo)];
}
function prj([x,y,z]:[number,number,number],fov:number){
  const d=fov+z; const s=fov/Math.max(d,1); return {px:x*s,py:y*s,s};
}

export default function BrianMap({
  onOpenWindow, onClose,
}: { onOpenWindow?: (c:string,t:string)=>void; onClose?: ()=>void }) {
  const [view, setView] = useState<'2d'|'3d'>('2d');
  // Pan/zoom 2D — stored in ref for wheel handler, synced to state for render
  const tfRef = useRef({x:0,y:0,scale:1});
  const [tf, _setTf] = useState({x:0,y:0,scale:1});
  const setTf = (v: typeof tf) => { tfRef.current = v; _setTf(v); };

  const [selected, setSelected] = useState<N|null>(null);
  const [hovered, setHovered] = useState<string|null>(null);
  const [expandNet, setExpandNet] = useState<string|null>(null);
  const [stats, setStats] = useState({agents:0,tools:25,skills:0,apps:0});

  // 3D
  const rotRef = useRef({x:0.18,y:0,zoom:1,px:0,py:0});
  const [rot, _setRot] = useState({x:0.18,y:0,zoom:1,px:0,py:0});
  const setRot = (v: typeof rot) => { rotRef.current = v; _setRot(v); };
  const autoRot = useRef(true);

  const drag = useRef<{sx:number;sy:number;tx:number;ty:number;rx:number;ry:number;rpx:number;rpy:number;is2d:boolean;isPan:boolean}|null>(null);
  const animRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w:1400,h:900});

  useEffect(()=>{
    const upd=()=>{
      if(containerRef.current) setSize({w:containerRef.current.clientWidth,h:containerRef.current.clientHeight});
    };
    upd(); window.addEventListener('resize',upd); return ()=>window.removeEventListener('resize',upd);
  },[]);

  useEffect(()=>{
    Promise.allSettled([
      api.get<any[]>('/agents/all'),
      api.get<any[]>('/tools'),
      api.get<any[]>('/skills'),
      api.get<any[]>('/apps'),
    ]).then(([ag,to,sk,ap])=>{
      setStats({
        agents:ag.status==='fulfilled'?ag.value.length:0,
        tools:to.status==='fulfilled'?to.value.length:25,
        skills:sk.status==='fulfilled'?sk.value.length:0,
        apps:ap.status==='fulfilled'?ap.value.length:0,
      });
    });
  },[]);

  // Animation loop
  useEffect(()=>{
    let t=0;
    const tick=()=>{
      t+=0.016;
      if(autoRot.current && view==='3d'){
        const r=rotRef.current;
        const nv={...r,y:r.y+0.004};
        rotRef.current=nv; _setRot(nv);
      }
      // Redraw canvas every frame when in 3D
      if(view==='3d') drawCanvas();
      animRef.current=requestAnimationFrame(tick);
    };
    animRef.current=requestAnimationFrame(tick);
    return()=>{ if(animRef.current) cancelAnimationFrame(animRef.current); };
  },[view]); // eslint-disable-line

  // ESC to close
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose?.(); };
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h);
  },[onClose]);

  // Non-passive wheel listener
  useEffect(()=>{
    const el=containerRef.current;
    if(!el) return;
    const handler=(e:WheelEvent)=>{
      e.preventDefault();
      const factor=e.deltaY<0?1.13:0.88;
      if(view==='2d'){
        const prev=tfRef.current;
        const bs=Math.max(0.45,Math.min(1,(Math.min(size.w,size.h)-120)/(RR[5]*2+120)));
        const ts=bs*prev.scale;
        const newScale=Math.max(0.15,Math.min(10,prev.scale*factor));
        const svgX=(e.clientX-size.w/2-prev.x)/ts;
        const svgY=(e.clientY-size.h/2-prev.y)/ts;
        const newTs=bs*newScale;
        const newX=e.clientX-size.w/2-svgX*newTs;
        const newY=e.clientY-size.h/2-svgY*newTs;
        setTf({x:newX,y:newY,scale:newScale});
      } else {
        const r=rotRef.current;
        const nz=Math.max(0.2,Math.min(5,r.zoom*factor));
        setRot({...r,zoom:nz});
      }
    };
    el.addEventListener('wheel',handler,{passive:false});
    return()=>el.removeEventListener('wheel',handler);
  },[view,size]); // eslint-disable-line

  const baseScale = Math.max(0.45, Math.min(1, (Math.min(size.w,size.h)-120)/(RR[5]*2+120)));
  const totalScale = baseScale * tf.scale;
  const cx = size.w/2 + tf.x;
  const cy = size.h/2 + tf.y;

  const connectedTo = useCallback((id:string)=>{
    const s=new Set<string>();
    CONNS.forEach(([a,b])=>{ if(a===id)s.add(b); if(b===id)s.add(a); });
    return s;
  },[]);

  // Mouse down
  const onMouseDown = useCallback((e:React.MouseEvent, is2d:boolean)=>{
    if(is2d){
      drag.current={sx:e.clientX,sy:e.clientY,tx:tf.x,ty:tf.y,rx:0,ry:0,rpx:0,rpy:0,is2d:true,isPan:false};
    } else {
      autoRot.current=false;
      const isPan=e.button===2||e.shiftKey;
      drag.current={sx:e.clientX,sy:e.clientY,tx:0,ty:0,
        rx:rotRef.current.x,ry:rotRef.current.y,
        rpx:rotRef.current.px,rpy:rotRef.current.py,
        is2d:false,isPan};
    }
  },[tf.x,tf.y]);

  const onMouseMove = useCallback((e:React.MouseEvent)=>{
    if(!drag.current) return;
    const dx=e.clientX-drag.current.sx, dy=e.clientY-drag.current.sy;
    if(drag.current.is2d){
      setTf({...tfRef.current,x:drag.current.tx+dx,y:drag.current.ty+dy});
    } else if(drag.current.isPan){
      setRot({...rotRef.current,px:drag.current.rpx+dx,py:drag.current.rpy+dy});
    } else {
      const ny=drag.current.ry+dx*0.005;
      const nx=Math.max(-1.4,Math.min(1.4,drag.current.rx+dy*0.005));
      setRot({...rotRef.current,x:nx,y:ny});
    }
  },[]);

  const onMouseUp = useCallback(()=>{ drag.current=null; },[]);

  const zoom = (f:number)=>{
    if(view==='2d'){
      const prev=tfRef.current;
      setTf({...prev,scale:Math.max(0.15,Math.min(10,prev.scale*f))});
    } else {
      const r=rotRef.current;
      setRot({...r,zoom:Math.max(0.2,Math.min(5,r.zoom*f))});
    }
  };
  const reset = ()=>{
    setTf({x:0,y:0,scale:1});
    setRot({x:0.18,y:0,zoom:1,px:0,py:0});
    autoRot.current=true;
  };

  // ── 3D canvas draw ────────────────────────────────────────────
  const drawCanvas = useCallback(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    const W=canvas.width, H=canvas.height;
    const r=rotRef.current;
    const CCX=W/2+r.px, CCY=H/2+r.py;
    const FOV=500;
    const SR=Math.min(W,H)*0.34*r.zoom;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#12151e';
    ctx.fillRect(0,0,W,H);

    // Stars (deterministic)
    for(let i=0;i<150;i++){
      const sx=(Math.sin(i*137.508)*0.5+0.5)*W;
      const sy=(Math.cos(i*79.311)*0.5+0.5)*H;
      const sr=i%50===0?1.5:i%10===0?1:0.5;
      const sa=0.15+((i*31)%10)*0.05;
      ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2);
      ctx.fillStyle=`rgba(180,220,255,${sa})`; ctx.fill();
    }

    const pos3: Record<string,[number,number,number]>={};
    NODES.forEach(n=>{
      const nr=n.ring===0?0:SR*(n.ring/5.5);
      pos3[n.id]=sph(n.lon,n.lat,nr,r.x,r.y);
    });

    // Connections (back to front)
    const cs=CONNS.map(([a,b])=>{
      const pa=pos3[a],pb=pos3[b]; if(!pa||!pb) return null;
      const na=NODES.find(n=>n.id===a)!,nb=NODES.find(n=>n.id===b)!;
      return {a,b,pa,pb,z:(pa[2]+pb[2])/2,na,nb};
    }).filter(Boolean).sort((x,y)=>x!.z-y!.z);

    cs.forEach(c=>{
      if(!c) return;
      const ppa=prj(c.pa,FOV), ppb=prj(c.pb,FOV);
      const ax=CCX+ppa.px, ay=CCY+ppa.py, bx=CCX+ppb.px, by=CCY+ppb.py;
      const depth=(ppa.s+ppb.s)/2;
      const isSel=selected?.id===c.a||selected?.id===c.b;
      const isHov=hovered===c.a||hovered===c.b;
      const alpha=depth*(isSel?0.85:isHov?0.5:0.12);
      ctx.beginPath(); ctx.moveTo(ax,ay);
      ctx.quadraticCurveTo((ax+bx)/2*0.4+CCX*0.6,(ay+by)/2*0.4+CCY*0.6,bx,by);
      ctx.strokeStyle=isSel?c.na.color:isHov?`rgba(0,200,255,${alpha*2})`:
        `rgba(0,150,220,${alpha})`;
      ctx.lineWidth=isSel?1.5:0.6;
      ctx.stroke();
    });

    // Nodes sorted front to back
    const np=NODES.map(n=>{const p=pos3[n.id];const pp=prj(p,FOV);return{n,x:CCX+pp.px,y:CCY+pp.py,z:p[2],s:pp.s};})
      .sort((a,b)=>a.z-b.z);

    np.forEach(({n,x,y,s})=>{
      const isSel=selected?.id===n.id, isHov=hovered===n.id;
      const nr=(n.ring===0?28:n.ring<=2?14:n.ring<=3?12:n.ring<=4?9:8)*Math.max(0.1,s);
      const a=Math.max(0.05,Math.min(1,0.15+s*0.85));

      // Glow
      const grd=ctx.createRadialGradient(x,y,0,x,y,nr*2.5);
      grd.addColorStop(0,`${n.color}${isSel?'bb':isHov?'66':'22'}`);
      grd.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(x,y,nr*2.5,0,Math.PI*2);
      ctx.fillStyle=grd; ctx.fill();

      // Body
      ctx.beginPath(); ctx.arc(x,y,nr,0,Math.PI*2);
      ctx.fillStyle=`rgba(3,8,18,${0.92*a})`; ctx.fill();
      ctx.strokeStyle=`${n.color}${Math.floor(a*220).toString(16).padStart(2,'0')}`;
      ctx.lineWidth=isSel?2:0.8; ctx.stroke();

      if(s>0.3){
        ctx.globalAlpha=a;
        ctx.font=`${Math.max(8,nr*0.9)}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(n.icon,x,y);
        ctx.globalAlpha=1;
        if(s>0.5){
          ctx.font=`${Math.max(6,nr*0.6)}px -apple-system,sans-serif`;
          ctx.fillStyle=isSel||isHov?n.color:`rgba(180,220,255,${0.45*a})`;
          ctx.fillText(n.label,x,y+nr+9*s);
        }
      }
    });

    // Center brain
    const bg=ctx.createRadialGradient(CCX-5,CCY-5,0,CCX,CCY,30);
    bg.addColorStop(0,'rgba(255,80,20,0.5)'); bg.addColorStop(0.6,'rgba(180,30,8,0.2)'); bg.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(CCX,CCY,30,0,Math.PI*2);
    ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle='rgba(255,60,30,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.font='bold 10px monospace'; ctx.fillStyle='rgba(255,240,235,0.35)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('BRAIN',CCX,CCY);
  },[selected,hovered]); // eslint-disable-line

  // Init canvas size + draw on 3D mode
  useEffect(()=>{
    if(view!=='3d'||!canvasRef.current) return;
    canvasRef.current.width=size.w;
    canvasRef.current.height=size.h;
    drawCanvas();
  },[view,size,rot,selected,hovered,drawCanvas]);

  const liveCount=(n:N)=>{
    const m:Record<string,number>={agents_sys:stats.agents,skills_lib:stats.skills,live_apps:stats.apps};
    return m[n.id];
  };

  const PW=300;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      position:'fixed',top:56,left:0,right:0,bottom:0,zIndex:1100,
      background:'var(--bg-primary, #0f1219)',
      display:'flex',flexDirection:'column',
      fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',
      userSelect:'none',
    }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Grid pattern uguale a FLOW */}
      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)',backgroundSize:'40px 40px',pointerEvents:'none',zIndex:0}}/>

      {/* ── HEADER ─────────────────────────────────── */}
      <div style={{
        height:52,display:'flex',alignItems:'center',padding:'0 16px',gap:8,
        background:'var(--bg-secondary, rgba(10,12,20,0.9))',
        backdropFilter:'blur(20px)',
        borderBottom:'1px solid var(--border-primary, rgba(255,255,255,0.06))',
        flexShrink:0,zIndex:1200,position:'relative',
      }}>
        <span style={{fontWeight:300,fontSize:13,letterSpacing:5,color:'rgba(224,230,240,0.7)'}}>BRIAN</span>
        <span style={{fontSize:9,fontWeight:300,color:'rgba(224,230,240,0.2)',letterSpacing:3,marginRight:8}}>OS MAP</span>

        {/* Stats */}
        {[{l:'Nodi',v:NODES.length},{l:'Link',v:CONNS.length},{l:'Agenti',v:stats.agents},{l:'Tool',v:stats.tools},{l:'Skill',v:stats.skills},{l:'App',v:stats.apps}].map(s=>(
          <div key={s.l} style={{padding:'0 8px',borderLeft:'1px solid rgba(255,255,255,0.06)',textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:800,color:'rgba(224,230,240,0.8)',lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:7.5,color:'rgba(224,230,240,0.3)',letterSpacing:1}}>{s.l.toUpperCase()}</div>
          </div>
        ))}

        <div style={{flex:1}}/>

        {/* View toggle */}
        <div style={{display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,border:'1px solid rgba(255,255,255,0.08)',gap:3}}>
          {[{k:'2d',l:'2D Vettoriale'},{k:'3d',l:'3D Sfera'}].map(v=>(
            <button key={v.k}
              onClick={()=>{setView(v.k as '2d'|'3d'); autoRot.current=v.k==='3d';}}
              style={{
                padding:'5px 18px',borderRadius:7,border:'none',cursor:'pointer',
                fontSize:12,fontWeight:700,letterSpacing:0.5,
                background:view===v.k?'rgba(255,255,255,0.1)':'transparent',
                color:view===v.k?'rgba(224,230,240,0.9)':'rgba(224,230,240,0.35)',
                boxShadow:'none',
                transition:'all 0.15s',
              }}>{v.l}</button>
          ))}
        </div>

        {/* Zoom */}
        <div style={{display:'flex',gap:4,marginLeft:8}}>
          {[{i:'−',f:0.75},{i:'+',f:1.35},{i:'⟳',f:0}].map(b=>(
            <button key={b.i}
              onClick={()=>b.f===0?reset():zoom(b.f)}
              style={{
                width:32,height:32,borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',
                background:'rgba(255,255,255,0.04)',color:'rgba(224,230,240,0.55)',cursor:'pointer',fontSize:16,
                display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s',
              }}
              onMouseEnter={e=>{(e.currentTarget).style.background='rgba(255,255,255,0.1)';(e.currentTarget).style.color='rgba(224,230,240,0.9)';}}
              onMouseLeave={e=>{(e.currentTarget).style.background='rgba(255,255,255,0.04)';(e.currentTarget).style.color='rgba(224,230,240,0.55)';}}
            >{b.i}</button>
          ))}
        </div>

        {/* Close */}
        {onClose && (
          <button onClick={onClose}
            style={{marginLeft:6,width:34,height:34,borderRadius:9,border:'1px solid rgba(239,68,68,0.25)',background:'rgba(239,68,68,0.1)',color:'rgba(239,68,68,0.65)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s'}}
            onMouseEnter={e=>{(e.currentTarget).style.background='rgba(239,68,68,0.25)';(e.currentTarget).style.color='#ef4444';}}
            onMouseLeave={e=>{(e.currentTarget).style.background='rgba(239,68,68,0.1)';(e.currentTarget).style.color='rgba(239,68,68,0.65)';}}
            title="Chiudi (ESC)"
          >✕</button>
        )}
      </div>

      {/* ── MAIN ───────────────────────────────────── */}
      <div style={{flex:1,position:'relative',overflow:'hidden'}}>

        {/* 2D SVG */}
        {view==='2d' && (
          <svg
            style={{position:'absolute',inset:0,width:'100%',height:'100%',cursor:drag.current?'grabbing':'grab'}}
            onMouseDown={e=>onMouseDown(e,true)}
            onClick={()=>{setSelected(null);setExpandNet(null);}}
          >
            <defs>
              <filter id='gl4'><feGaussianBlur stdDeviation='4' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
              <filter id='gl2'><feGaussianBlur stdDeviation='2' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
              <filter id='blr8'><feGaussianBlur stdDeviation='8'/></filter>
              <radialGradient id='bgrd' cx='35%' cy='30%' r='65%'>
                <stop offset='0%' stopColor='rgba(255,80,20,0.3)'/>
                <stop offset='50%' stopColor='rgba(160,20,5,0.12)'/>
                <stop offset='100%' stopColor='rgba(4,10,24,0.95)'/>
              </radialGradient>
            </defs>

            <g transform={`translate(${cx},${cy}) scale(${totalScale})`}>

              {/* Orbital rings */}
              {[1,2,3,4,5].map(ri=>(
                <g key={ri}>
                  <circle r={RR[ri]} fill='none' stroke='rgba(0,200,255,0.07)' strokeWidth={0.8/totalScale}
                    strokeDasharray={`${5/totalScale} ${12/totalScale}`}/>
                  <text x={RR[ri]+3/totalScale} y={-3/totalScale}
                    fontSize={8/totalScale} fill='rgba(0,180,220,0.12)'
                    style={{letterSpacing:1}}>
                    {['','CORE','PROVIDERS','FEATURES','TOOLS','SERVICES'][ri]}
                  </text>
                </g>
              ))}

              {/* Connections */}
              {CONNS.map(([aid,bid],ci)=>{
                const na=NODES.find(n=>n.id===aid), nb=NODES.find(n=>n.id===bid);
                if(!na||!nb) return null;
                const pa=npos(na), pb=npos(nb);
                const isSel=selected?.id===aid||selected?.id===bid;
                const isHov=hovered===aid||hovered===bid;
                const cpx=(pa.x+pb.x)*0.28, cpy=(pa.y+pb.y)*0.28;
                const d=`M ${pa.x.toFixed(1)} ${pa.y.toFixed(1)} Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`;
                const lw=0.8/totalScale;
                return (
                  <g key={`c${ci}`} style={{pointerEvents:'none'}}>
                    {/* Glow */}
                    <path d={d} fill='none' stroke={na.color} strokeWidth={lw*4}
                      opacity={isSel?0.3:isHov?0.18:0.06} filter='url(#blr8)'/>
                    {/* Line */}
                    <path d={d} fill='none'
                      stroke={isSel?na.color:isHov?'rgba(0,200,255,0.6)':'rgba(0,160,200,0.28)'}
                      strokeWidth={isSel?lw*1.8:lw}
                      strokeDasharray={isSel?'none':`${6/totalScale} ${14/totalScale}`}
                      opacity={isSel?0.9:0.55}/>
                    {/* Animated dot */}
                    {(isSel||isHov) && (
                      <circle r={isSel?3/totalScale:2/totalScale}
                        fill={isSel?na.color:'rgba(0,220,255,0.8)'}
                        opacity={0.9}>
                        <animateMotion dur={isSel?'1.0s':'1.5s'} repeatCount='indefinite' path={d}/>
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Brain center */}
              <g style={{pointerEvents:'none'}}>
                <circle r={80} fill='rgba(255,60,20,0.08)' filter='url(#blr8)'/>
                <circle r={62} fill='url(#bgrd)'/>
                <circle r={62} fill='none' stroke='rgba(255,60,30,0.45)' strokeWidth={1.2/totalScale}/>
                {/* Folds */}
                {[
                  'M -18,-45 C 6,-33 10,-12 5,8',
                  'M 20,-52 C 36,-38 40,-18 32,0',
                  'M -36,-26 C -24,-10 -22,10 -26,28',
                  'M 46,-30 C 56,-14 52,6 44,22',
                  'M 2,22 C 12,34 14,48 8,58',
                  'M -22,16 C -32,30 -32,46 -28,56',
                ].map((p,i)=>(
                  <path key={i} d={p} fill='none'
                    stroke={`rgba(255,${70+i*12},${20+i*6},0.28)`}
                    strokeWidth={1/totalScale} strokeLinecap='round'/>
                ))}
                {/* Synapses */}
                {[[-6,-52],[20,-62],[-28,-34],[48,-36],[4,26],[-20,20],[36,-16],[12,46]].map(([sx,sy],i)=>(
                  <circle key={i} cx={sx} cy={sy} r={1.5/totalScale}
                    fill='rgba(0,230,255,0.5)' filter='url(#gl2)'/>
                ))}
                <text x={0} y={-4} textAnchor='middle'
                  fontSize={18/totalScale} fontWeight={900} letterSpacing={7/totalScale}
                  fill='rgba(255,245,240,0.18)'>BRAIN</text>
                <text x={0} y={12/totalScale} textAnchor='middle'
                  fontSize={6/totalScale} letterSpacing={3.5/totalScale}
                  fill='rgba(0,200,255,0.14)'>AI OPERATING SYSTEM</text>
                <circle r={48} fill='none' stroke='rgba(0,200,255,0.07)'
                  strokeWidth={0.7/totalScale} strokeDasharray={`3 8`}/>
              </g>

              {/* Nodes */}
              {NODES.filter(n=>n.ring>0).map(n=>{
                const p=npos(n);
                const isSel=selected?.id===n.id, isHov=hovered===n.id;
                const conns=selected?connectedTo(selected.id):null;
                const dimmed=selected&&!(conns?.has(n.id)||selected.id===n.id);
                const baseR=n.ring<=2?20:n.ring<=3?17:n.ring<=4?13:11;
                const nr=baseR*(isSel?1.32:isHov?1.15:1);
                const lw=0.9/totalScale;
                const cnt=liveCount(n);
                const fs=nr;
                return (
                  <g key={n.id} transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`}
                    onClick={e=>{e.stopPropagation();setSelected(prev=>prev?.id===n.id?null:n);setExpandNet(null);}}
                    onMouseEnter={()=>setHovered(n.id)}
                    onMouseLeave={()=>setHovered(null)}
                    style={{cursor:'pointer',opacity:dimmed?0.1:1,transition:'opacity 0.2s'}}>
                    {/* Glow */}
                    <circle r={nr*1.9} fill={n.color} filter='url(#blr8)'
                      opacity={isSel?0.5:isHov?0.28:0.08}/>
                    {/* Orbit ring */}
                    <circle r={nr+5/totalScale} fill='none' stroke={n.color}
                      strokeWidth={isSel?lw*1.2:lw*0.7}
                      strokeDasharray={isSel?'none':`${3/totalScale} ${5/totalScale}`}
                      opacity={isSel?0.7:0.25}/>
                    {/* Body */}
                    <circle r={nr}
                      fill={isSel?`rgba(${h2r(n.color)},0.14)`:'rgba(3,8,20,0.93)'}
                      stroke={n.color} strokeWidth={lw*(isSel?1.5:0.85)}/>
                    {/* Inner ring */}
                    <circle r={nr*0.5} fill='none' stroke={n.color}
                      strokeWidth={lw*0.4} opacity={0.18}
                      strokeDasharray={`${2/totalScale} ${5/totalScale}`}/>
                    {/* Icon */}
                    <text x={0} y={n.sub?nr*0.05:nr*0.15} textAnchor='middle' dominantBaseline='middle'
                      style={{fontSize:`${fs*0.78}px`,userSelect:'none'}}>{n.icon}</text>
                    {/* Label */}
                    <text x={0} y={nr+13/totalScale} textAnchor='middle'
                      style={{
                        fontSize:`${Math.max(7,9)/totalScale}px`,
                        fontWeight:600,
                        fill:isSel||isHov?n.color:'rgba(180,225,255,0.65)',
                        userSelect:'none',
                      }}>{n.label}</text>
                    {n.sub && (
                      <text x={0} y={nr+23/totalScale} textAnchor='middle'
                        style={{fontSize:`${7/totalScale}px`,fill:'rgba(0,180,220,0.28)',userSelect:'none'}}>{n.sub}</text>
                    )}
                    {/* Count badge */}
                    {cnt!==undefined && cnt>0 && (
                      <>
                        <circle cx={nr*0.72} cy={-nr*0.72} r={8/totalScale} fill={n.color} opacity={0.9}/>
                        <text x={nr*0.72} y={-nr*0.72+3/totalScale} textAnchor='middle'
                          style={{fontSize:`${6/totalScale}px`,fontWeight:800,fill:'white',userSelect:'none'}}>{cnt>99?'99+':cnt}</text>
                      </>
                    )}
                    {isSel && (
                      <circle r={nr+12/totalScale} fill='none' stroke={n.color}
                        strokeWidth={lw*0.8} opacity={0.25}/>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Legend */}
            <g transform={`translate(16,${size.h-26})`}>
              {[{l:'Core',c:'#fbbf24'},{l:'Provider',c:'#3b82f6'},{l:'Feature',c:'#a78bfa'},{l:'Tool',c:'#64748b'},{l:'Service',c:'#34d399'}].map((lg,i)=>(
                <g key={lg.l} transform={`translate(${i*78},0)`}>
                  <circle r={4} cx={0} cy={0} fill={lg.c} opacity={0.7}/>
                  <text x={10} y={4} style={{fontSize:'9px',fill:'rgba(0,180,220,0.3)',letterSpacing:1,userSelect:'none'}}>{lg.l.toUpperCase()}</text>
                </g>
              ))}
              <text x={420} y={4} style={{fontSize:'9px',fill:'rgba(0,180,220,0.2)',userSelect:'none'}}>Scroll=zoom • Drag=pan • Click=dettagli • ESC=chiudi</text>
            </g>
          </svg>
        )}

        {/* 3D Canvas */}
        {view==='3d' && (
          <canvas ref={canvasRef}
            style={{position:'absolute',inset:0,cursor:drag.current?(drag.current.isPan?'move':'grabbing'):'grab',display:'block'}}
            onMouseDown={e=>onMouseDown(e,false)}
            onContextMenu={e=>e.preventDefault()}
            onClick={e=>{
              // Select node on click
              const canvas=canvasRef.current; if(!canvas) return;
              const rect=canvas.getBoundingClientRect();
              const mx=e.clientX-rect.left, my=e.clientY-rect.top;
              const W=size.w,H=size.h,CCX=W/2,CCY=H/2,FOV=500;
              const r=rotRef.current; const SR=Math.min(W,H)*0.34*r.zoom;
              let closest:N|null=null, minD=40;
              NODES.forEach(n=>{
                const nr2=n.ring===0?0:SR*(n.ring/5.5);
                const p=sph(n.lon,n.lat,nr2,r.x,r.y);
                const pp=prj(p,FOV);
                const sx=CCX+pp.px, sy=CCY+pp.py;
                const nr=( n.ring===0?28:n.ring<=2?14:n.ring<=3?12:n.ring<=4?9:8)*Math.max(0.1,pp.s);
                const d=Math.hypot(mx-sx,my-sy);
                if(d<nr+12&&d<minD+nr){minD=d;closest=n;}
              });
              if(closest) setSelected(prev=>prev?.id===(closest as N).id?null:closest);
              else setSelected(null);
            }}
          />
        )}

        {/* ── Detail panel ── */}
        {selected && (()=>{
          const pos2=npos(selected);
          const screenX=cx+pos2.x*totalScale, screenY=cy+pos2.y*totalScale;
          let left=screenX+30, top=screenY-180;
          if(left+PW>size.w-10) left=screenX-PW-30;
          if(top<58) top=58;
          if(top+440>size.h-10) top=size.h-450;
          if(view==='3d'){left=size.w-PW-16;top=60;}
          const nb=NODES.filter(n=>connectedTo(selected.id).has(n.id));
          const cnt=liveCount(selected);
          return (
            <div onClick={e=>e.stopPropagation()} style={{
              position:'absolute',left,top,width:PW,
              background:'rgba(15,18,25,0.97)',backdropFilter:'blur(24px)',
              border:`1px solid ${selected.color}28`,borderRadius:13,
              boxShadow:`0 0 40px ${selected.color}14, 0 8px 60px rgba(0,0,0,0.75)`,
              zIndex:700,overflow:'hidden',
            }}>
              {/* Header */}
              <div style={{padding:'13px 15px',background:`rgba(${h2r(selected.color)},0.05)`,borderBottom:`1px solid ${selected.color}18`}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:`rgba(${h2r(selected.color)},0.1)`,border:`1.5px solid ${selected.color}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{selected.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:selected.color}}>{selected.label}</div>
                    {selected.sub && <div style={{fontSize:9,color:'rgba(0,180,220,0.4)',letterSpacing:1.5,textTransform:'uppercase',marginTop:1}}>{selected.sub}</div>}
                    <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:`rgba(${h2r(selected.color)},0.12)`,color:`rgba(${h2r(selected.color)},0.9)`,letterSpacing:0.8}}>{selected.cat.toUpperCase()}</span>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'rgba(0,180,220,0.3)',cursor:'pointer',fontSize:15,padding:'2px 5px'}}>✕</button>
                </div>
                {cnt!==undefined && cnt>0 && (
                  <div style={{marginTop:7,fontSize:11,color:'rgba(0,180,220,0.4)'}}>
                    <span style={{fontSize:22,fontWeight:900,color:selected.color,marginRight:4}}>{cnt}</span>nel sistema
                  </div>
                )}
              </div>
              {/* Desc */}
              <div style={{padding:'9px 15px',fontSize:11,color:'rgba(160,210,240,0.72)',lineHeight:1.7,borderBottom:'1px solid rgba(0,180,220,0.06)'}}>{selected.desc}</div>
              {/* Items */}
              {selected.items && (
                <div style={{padding:'7px 15px',borderBottom:'1px solid rgba(0,180,220,0.06)',maxHeight:110,overflowY:'auto'}}>
                  {selected.items.map((item,i)=>(
                    <div key={i} style={{display:'flex',gap:6,fontSize:10,color:'rgba(140,200,230,0.55)',marginBottom:3,lineHeight:1.5}}>
                      <span style={{color:selected.color,flexShrink:0}}>▸</span>{item}
                    </div>
                  ))}
                </div>
              )}
              {/* Neighbors */}
              <div style={{padding:'7px 15px',borderBottom:'1px solid rgba(0,180,220,0.06)'}}>
                <div style={{fontSize:8.5,color:'rgba(0,180,220,0.28)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:5}}>Connessioni ({nb.length})</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {nb.slice(0,13).map(n=>(
                    <div key={n.id} onClick={()=>setSelected(n)}
                      style={{padding:'2px 6px',borderRadius:20,fontSize:9,cursor:'pointer',
                        background:`rgba(${h2r(n.color)},0.08)`,border:`1px solid ${n.color}22`,
                        color:n.color,display:'flex',alignItems:'center',gap:3}}
                    >{n.icon} {n.label}</div>
                  ))}
                  {nb.length>13 && <span style={{fontSize:9,color:'rgba(0,180,220,0.2)'}}>+{nb.length-13}</span>}
                </div>
              </div>
              {/* Actions */}
              <div style={{padding:'7px 15px',display:'flex',gap:5,flexWrap:'wrap'}}>
                <button onClick={()=>setExpandNet(p=>p===selected.id?null:selected.id)}
                  style={{padding:'5px 11px',fontSize:10,borderRadius:6,cursor:'pointer',background:'rgba(0,180,220,0.08)',border:'1px solid rgba(0,180,220,0.2)',color:'rgba(0,210,255,0.8)',fontWeight:600}}>
                  {expandNet===selected.id?'↑ Chiudi':'↓ Espandi rete'}
                </button>
                {selected.actions?.map((a,i)=>(
                  <button key={i} onClick={()=>{onOpenWindow?.(a.win||selected.id,a.label);setSelected(null);}}
                    style={{padding:'5px 11px',fontSize:10,borderRadius:6,cursor:'pointer',background:`rgba(${h2r(selected.color)},0.1)`,border:`1px solid ${selected.color}28`,color:selected.color,fontWeight:600}}>
                    {a.label} →
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Expanded sub-network ── */}
        {expandNet && (()=>{
          const center=NODES.find(n=>n.id===expandNet)!;
          const nb=NODES.filter(n=>connectedTo(expandNet).has(n.id));
          const bW=size.w-(selected?PW+50:30);
          const ncx=bW/2, ncy=95;
          const step=(2*Math.PI)/Math.max(nb.length,1);
          const mr=Math.min(135,bW/3);
          return (
            <div onClick={e=>e.stopPropagation()} style={{
              position:'absolute',left:12,bottom:8,right:selected?PW+34:12,height:225,
              background:'rgba(2,5,14,0.95)',backdropFilter:'blur(22px)',borderRadius:13,
              border:`1px solid ${center.color}18`,zIndex:650,overflow:'hidden',
            }}>
              <div style={{padding:'6px 14px',borderBottom:`1px solid ${center.color}10`,fontSize:10,fontWeight:700,letterSpacing:2,color:center.color,textTransform:'uppercase',background:`rgba(${h2r(center.color)},0.04)`}}>
                {center.icon} {center.label} — {nb.length} connessioni dirette
              </div>
              <svg style={{width:'100%',height:182}}>
                {nb.map((n2,i)=>{
                  const nx=ncx+mr*Math.cos(i*step-Math.PI/2);
                  const ny=ncy+mr*Math.sin(i*step-Math.PI/2);
                  return (
                    <g key={n2.id} style={{cursor:'pointer'}} onClick={()=>setSelected(n2)}>
                      <line x1={ncx} y1={ncy} x2={nx} y2={ny}
                        stroke={n2.color} strokeWidth={0.6} opacity={0.32} strokeDasharray='3 6'/>
                      <circle cx={nx} cy={ny} r={14} fill='rgba(2,6,16,0.96)' stroke={n2.color} strokeWidth={0.7}/>
                      <text x={nx} y={ny} textAnchor='middle' dominantBaseline='middle'
                        style={{fontSize:'12px',userSelect:'none'}}>{n2.icon}</text>
                      <text x={nx} y={ny+22} textAnchor='middle'
                        style={{fontSize:'8px',fill:'rgba(140,200,230,0.5)',userSelect:'none'}}>{n2.label}</text>
                    </g>
                  );
                })}
                <circle cx={ncx} cy={ncy} r={26} fill={`rgba(${h2r(center.color)},0.1)`} stroke={center.color} strokeWidth={1.5}/>
                <text x={ncx} y={ncy} textAnchor='middle' dominantBaseline='middle'
                  style={{fontSize:'16px',userSelect:'none'}}>{center.icon}</text>
                <text x={ncx} y={ncy+38} textAnchor='middle'
                  style={{fontSize:'9px',fontWeight:700,fill:center.color,userSelect:'none'}}>{center.label}</text>
              </svg>
            </div>
          );
        })()}

        {/* Instructions */}
        <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',fontSize:9,color:'rgba(0,180,220,0.18)',letterSpacing:2,pointerEvents:'none',whiteSpace:'nowrap',textTransform:'uppercase',zIndex:2}}>
          {view==='2d'?'Scroll=zoom • Drag=pan • Click=dettagli • ESC=chiudi':'Drag=ruota • Scroll=zoom • Click=dettagli • ESC=chiudi'}
        </div>
      </div>
    </div>
  );
}
