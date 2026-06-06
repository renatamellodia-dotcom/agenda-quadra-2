import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, where, serverTimestamp, runTransaction, doc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI",
  authDomain: "agendamento-quadras-ad13b.firebaseapp.com",
  projectId: "agendamento-quadras-ad13b",
  storageBucket: "agendamento-quadras-ad13b.firebasestorage.app",
  messagingSenderId: "228136379926",
  appId: "1:228136379926:web:7741e85184909b1ecff737"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const V = "#2E7D6B", VE = "#1a5248", LA = "#E8861A", BG = "#f4f5f7";

const MP_ACCESS_TOKEN = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";

async function gerarPixPagamento(dados) {
  try {
    const resp = await fetch("/api/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await resp.json();
    if (json.qrCode) return json;
    return null;
  } catch (e) { return null; }
}

function validarCPF(c) {
  c = c.replace(/[^0-9]/g,"");
  if (c.length !== 11 || /^(.)+$/.test(c)) return false;
  let s=0; for(let i=0;i<9;i++) s+=parseInt(c[i])*(10-i);
  let r=(s*10)%11; if(r>=10) r=0; if(r!==parseInt(c[9])) return false;
  s=0; for(let i=0;i<10;i++) s+=parseInt(c[i])*(11-i);
  r=(s*10)%11; if(r>=10) r=0; return r===parseInt(c[10]);
}

function validarEmail(em) { return /^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(em.trim()); }
function validarTel(t) { return t.replace(/[^0-9]/g,"").length >= 10; }
function validarNome(nm) { return nm.trim().split(" ").filter(function(p){return p.length>0;}).length >= 2; }

const QUADRAS = [
  { id:"q1", nome:"Campo Society", tipo:"Futebol Society", cor:V, preco:120, precoNoite:130, horarioNoite:"16:00", cob:"horario", fx:null },
  { id:"q2", nome:"Quadra de Areia", tipo:"Futevôlei · Vôlei · Beach Tennis", cor:LA, cob:"areia", preco:60, pessoasBase:12, acrescimoPessoa:10 }
];

const HORARIOS_OCUPADOS = [
  { qid:"q1", data:"2026-06-03", ini:"19:00", fim:"20:00", nome:"Reservado" },
  { qid:"q1", data:"2026-06-03", ini:"20:00", fim:"21:00", nome:"Reservado" },
  { qid:"q2", data:"2026-06-03", ini:"18:00", fim:"19:00", nome:"Reservado" },
];

const PIX = "(22) 99900-8085";
const WPP = "5522999008085";

function toDS(d){ return d.toISOString().split("T")[0]; }
function hoje(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function fd(s){ if(!s)return""; const[a,m,d]=s.split("-"); return`${d}/${m}`; }
function nomeDia(d){
  const hj=hoje();
  if(toDS(d)===toDS(hj)) return "Hoje";
  const am=new Date(hj); am.setDate(am.getDate()+1);
  if(toDS(d)===toDS(am)) return "Amanhã";
  return d.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"});
}

function gerarDias(){
  const dias=[];
  for(let i=0;i<22;i++){
    const d=new Date(hoje());
    d.setDate(d.getDate()+i);
    dias.push(d);
  }
  return dias;
}

const REGRAS_AREIA = [
  { titulo:"🏖️ REGRAS EXCLUSIVAS DA QUADRA DE AREIA", tipo:"header" },
  { num:"1", titulo:"Área Reservada Exclusiva", texto:"A locação da Quadra de Areia inclui o uso exclusivo da quadra, do deck e da churrasqueira da área reservada. Durante o período contratado, esses espaços ficam destinados exclusivamente aos participantes da locação. Para utilização da churrasqueira exclusiva, o período mínimo de locação é de 5 horas." },
  { num:"2", titulo:"Participantes da Locação", texto:"São considerados participantes todas as pessoas que utilizarem a área reservada da Quadra de Areia (quadra, deck e churrasqueira), independentemente de estarem jogando." },
  { titulo:"⚠️ REGRAS GERAIS DO COMPLEXO", tipo:"header" },
  { num:"3", titulo:"Consumo no Local", texto:"Não é permitida a entrada de bebidas. O consumo deverá ser realizado através do bar do complexo." },
  { num:"4", titulo:"Crianças", texto:"Por questões de segurança, não é permitida a permanência de crianças nas quadras durante os jogos." },
  { num:"5", titulo:"Eventos e Comemorações", texto:"A locação das quadras destina-se à prática esportiva e confraternização entre os participantes da reserva. Aniversários, confraternizações, eventos corporativos, comemorações e reuniões com convidados externos possuem condições e valores específicos e devem ser contratados separadamente." },
];

const REGRAS_SOCIETY = [
  { titulo:"⚠️ REGRAS GERAIS DO COMPLEXO", tipo:"header" },
  { num:"1", titulo:"Consumo no Local", texto:"Não é permitida a entrada de bebidas. O consumo deverá ser realizado através do bar do complexo." },
  { num:"2", titulo:"Crianças", texto:"Por questões de segurança, não é permitida a permanência de crianças nas quadras durante os jogos." },
  { num:"3", titulo:"Eventos e Comemorações", texto:"A locação das quadras destina-se à prática esportiva. Eventos com convidados externos possuem condições específicas." },
];

export default function App() {
  const [etapa, setEtapa] = useState("inicio");
  const [quadra, setQuadra] = useState(null);
  const [dia, setDia] = useState(hoje());
  const [slot, setSlot] = useState(null);
  const [pessoas, setPessoas] = useState("");
  const [valor, setValor] = useState(0);
  const [hintPess, setHintPess] = useState("");
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [obs, setObs] = useState("");
  const [sauna, setSauna] = useState(false);
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState({});
  const [ciente, setCiente] = useState(false);
  const [loadingPag, setLoadingPag] = useState(false);
  const [porcPag, setPorcPag] = useState(100);
  const [reservas, setReservas] = useState([]);
  const [dadosPix, setDadosPix] = useState(null);
  const [slotsSel, setSlotsSel] = useState([]);

  const dias = gerarDias();

  useEffect(()=>{
    try {
      const q = query(collection(db,"agendamentos"), where("st","!=","cancelado"));
      const unsub = onSnapshot(q, snap=>{
        setReservas(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase offline",e); }
  },[]);

  function toMin(hr){ const[h,m]=hr.split(":").map(Number); return h*60+m; }
  function toHr(min){ return Math.floor(min/60).toString().padStart(2,"0")+":"+((min%60).toString().padStart(2,"0")); }

  function calcValorSlots(slots, q) {
    return slots.reduce((total, hr) => {
      if (q.cob === "horario") return total + precoSociety(hr, q);
      if (q.cob === "fixo") return total + q.preco / 2;
      if (q.cob === "areia") return total + q.preco / 2;
      return total;
    }, 0);
  }

  function toggleSlot(hr, hf, q) {
    setQuadra(q);
    setSlotsSel(prev => {
      if (prev.includes(hr)) {
        return prev.filter(s => s !== hr);
      }
      const todos = [...prev, hr].sort();
      for (let i = 0; i < todos.length - 1; i++) {
        if (toMin(todos[i]) + 30 !== toMin(todos[i+1])) {
          return [hr];
        }
      }
      return todos;
    });
  }

  function confirmarSlots() {
    if (slotsSel.length === 0) return;
    const sorted = [...slotsSel].sort();
    const ini = sorted[0];
    const fim = toHr(toMin(sorted[sorted.length-1]) + 30);
    setSlot({ini, fim});
    setPessoas(""); setHintPess("");
    const val = quadra.cob === "pessoas" ? 0 : calcValorSlots(sorted, quadra);
    setValor(val);
    setSlotsSel([]);
    setEtapa(quadra.cob === "pessoas" ? "pessoas" : "form");
  }

  function calcValor(q, n) {
    if (q.cob === "fixo") return q.preco;
    if (q.cob === "areia") {
      const num = parseInt(n)||0;
      const baseSlots = calcValorSlots(slotsSel, q);
      const numSlots = slotsSel.length;
      const extraPessoas = (numSlots >= 2 && num > q.pessoasBase) ? (num - q.pessoasBase) * q.acrescimoPessoa : 0;
      const total = baseSlots + extraPessoas;
      if (extraPessoas > 0) setHintPess(num+" pessoas → R$"+baseSlots+" + "+(num-q.pessoasBase)+"×R$10 = R$"+total);
      else setHintPess(num+" pessoa"+(num>1?"s":"")+" → R$"+total);
      return total;
    }
    if (!n || n <= 0) return 0;
    const num = parseInt(n);
    const faixa = (q.fx||[]).find(x => num <= x.a);
    if (faixa) { setHintPess(num+" pessoa"+(num>1?"s":"")+" → R$"+faixa.v+"/hora"); return faixa.v; }
    const extra = num - 12;
    const total = 70 + (extra * 10);
    setHintPess(num+" pessoas → R$70 + "+extra+"×R$10 = R$"+total+"/hora");
    return total;
  }

  function precoSociety(ini, q) {
    if (q.cob !== "horario") return q.preco;
    const valorHora = ini >= q.horarioNoite ? q.precoNoite : q.preco;
    return valorHora / 2;
  }

  function confirmarPessoas() {
    if (!pessoas || parseInt(pessoas) < 1) return;
    const v = calcValor(quadra, pessoas);
    setValor(v);
    setEtapa("form");
  }

  function confirmarReserva() {
    const errsNovos = {};
    if (!validarNome(nome)) errsNovos.nome = "Digite seu nome e sobrenome";
    if (!validarTel(tel)) errsNovos.tel = "Telefone inválido — informe com DDD";
    if (cpf && !validarCPF(cpf)) errsNovos.cpf = "CPF inválido — verifique os números";
    if (!validarEmail(email)) errsNovos.email = "E-mail inválido — ex: nome@gmail.com";
    if (Object.keys(errsNovos).length > 0) { setErros(errsNovos); return; }
    setErros({});
    setCiente(false);
    setEtapa("regras");
  }

  async function confirmarRegras() {
    if (!ciente) return;
    setLoadingPag(true);

    const extRef = quadra.id+"-"+toDS(dia)+"-"+slot.ini+"-"+Date.now();
    const novaReserva = {
      qid: quadra.id,
      qnm: quadra.nome,
      data: toDS(dia),
      ini: slot.ini,
      fim: slot.fim,
      cli: nome,
      tel: tel,
      cpf: cpf||"",
      obs: obs||"",
      pess: parseInt(pessoas)||null,
      sauna: sauna||false,
      val: parseFloat(valor),
      pag: "pendente",
      st: "aguardando_pagamento",
      email: email,
      extRef: extRef,
      tp: "avulso",
      criadoEm: serverTimestamp()
    };

    try {
      let slotOcupado = false;
      await runTransaction(db, async (transaction) => {
        const q = query(
          collection(db, "agendamentos"),
          where("qid", "==", quadra.id),
          where("data", "==", toDS(dia)),
          where("ini", "==", slot.ini),
          where("st", "in", ["aguardando_pagamento", "confirmado"])
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          slotOcupado = true;
          return;
        }
        const novoRef = doc(collection(db, "agendamentos"));
        transaction.set(novoRef, novaReserva);
      });

      if (slotOcupado) {
        alert("⚠️ Este horário acabou de ser reservado. Por favor, escolha outro.");
        setEtapa("horario");
        setLoadingPag(false);
        return;
      }
    } catch(e){ console.log("Erro Firebase:", e); }

    const valorCobrar = parseFloat((valor * (porcPag/100)).toFixed(2));
    const pix = await gerarPixPagamento({
      quadraNome: quadra.nome,
      quadraId: quadra.id,
      data: toDS(dia),
      ini: slot.ini,
      valor: valorCobrar,
      nome, tel, email, extRef, cpf
    });
    setLoadingPag(false);
    if (pix) {
      setDadosPix(pix);
      setEtapa("pix");
    } else {
      setEtapa("pix");
    }
  }

  const ocupadosDia = reservas.filter(r => r.qid === quadra?.id && r.data === toDS(dia));

  function isOcupado(hr) {
    return ocupadosDia.some(r => r.ini <= hr && r.fim > hr);
  }

  // ── TELA INÍCIO ──
  if (etapa === "inicio") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:VE,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{padding:"24px 24px 16px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
        <div style={{textAlign:"left"}}>
          <div style={{fontWeight:800,fontSize:22,color:"white",letterSpacing:0.5,lineHeight:1.2}}>COMPLEXO</div>
          <div style={{fontWeight:800,fontSize:22,color:LA,letterSpacing:0.5,lineHeight:1.2}}>MELODIA</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:4,lineHeight:1.4}}>
            Esporte, lazer e<br/>confraternização!
          </div>
        </div>
      </div>

      <div style={{textAlign:"center",padding:"0 16px 20px"}}>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
        <div style={{display:"inline-flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.12)",borderRadius:30,padding:"10px 20px",cursor:"pointer"}} onClick={()=>document.getElementById('secaoReserva')?.scrollIntoView({behavior:'smooth'})}>
          <span style={{color:"rgba(255,255,255,0.8)",fontSize:13,fontWeight:700}}>Agendar quadra</span>
          <span style={{fontSize:16,animation:"bounce 1.2s infinite",display:"inline-block"}}>⬇️</span>
        </div>
      </div>

      <div style={{background:"rgba(255,255,255,0.08)",margin:"0 16px 14px",borderRadius:14,padding:"14px 16px"}}>
        <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Horários de funcionamento</div>
        <div style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:"rgba(255,255,255,0.8)",fontSize:14}}>🕒 Segunda a sexta</span>
            <span style={{color:"white",fontWeight:700,fontSize:14}}>16h às 23h</span>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3}}>🌿 Sauna: 18h às 22h</div>
        </div>
        <div style={{padding:"8px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:"rgba(255,255,255,0.8)",fontSize:14}}>🕒 Sábado e domingo</span>
            <span style={{color:"white",fontWeight:700,fontSize:14}}>9h às 18h</span>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3}}>🌿 Sauna: 10h às 17h</div>
        </div>
      </div>

      <div style={{background:"rgba(255,255,255,0.08)",margin:"0 16px 14px",borderRadius:14,padding:"14px 16px"}}>
        <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Nossa estrutura</div>
        {[
          ["🏟️","Campo Society",""],
          ["🏖️","Quadra de Areia","Futevôlei, vôlei e beach tennis"],
          ["🌿","Sauna",""],
          ["🍖","Churrasqueira","Mediante reserva antecipada via WhatsApp"],
          ["🚗","Estacionamento gratuito",""],
          ["📶","Wi-Fi gratuito",""],
          ["🍻","Bar","Bebidas e petiscos"],
        ].map(([ic,nm,det])=>(
          <div key={nm} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <span style={{fontSize:20,width:28,textAlign:"center",flexShrink:0}}>{ic}</span>
            <div>
              <span style={{color:"white",fontWeight:600,fontSize:14}}>{nm}</span>
              {det&&<span style={{color:"rgba(255,255,255,0.55)",fontSize:13}}> — {det}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",margin:"0 16px 14px",borderRadius:12,padding:"12px 16px",display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:20,flexShrink:0}}>🚫</span>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.5}}>
          Para a segurança de todos, <strong style={{color:"white"}}>não é permitida a entrada de crianças nas quadras</strong> durante os jogos.
        </div>
      </div>

      <div style={{margin:"0 16px 14px",background:"rgba(232,134,26,0.15)",border:"1.5px solid rgba(232,134,26,0.4)",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,color:"white",fontSize:16,marginBottom:12}}>🍖 Churrasqueiras</div>
        <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
          <div style={{fontWeight:700,color:"white",fontSize:14,marginBottom:2}}>Churrasqueira 1 e Churrasqueira 2</div>
          <div style={{color:"rgba(255,255,255,0.7)",fontSize:13,lineHeight:1.5,marginBottom:10}}>
            Disponíveis para todos os clientes. Verifique disponibilidade e faça sua reserva pelo WhatsApp.
          </div>
          <a href={`https://wa.me/${WPP}?text=Olá! Gostaria de verificar a disponibilidade das churrasqueiras.`}
            style={{display:"inline-flex",alignItems:"center",gap:8,background:LA,color:"white",padding:"9px 16px",borderRadius:10,fontSize:13,fontWeight:700,textDecoration:"none"}}>
            💬 Verificar disponibilidade
          </a>
        </div>
        <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px"}}>
          <div style={{fontWeight:700,color:"white",fontSize:14,marginBottom:2}}>Churrasqueira Exclusiva da Areia</div>
          <div style={{color:"rgba(255,255,255,0.7)",fontSize:13,lineHeight:1.5,marginBottom:6}}>
            Inclusa na locação da Quadra de Areia com <strong style={{color:"white"}}>mínimo de 5 horas</strong>.
          </div>
          <div style={{background:"rgba(232,134,26,0.3)",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,color:"white",display:"inline-flex",alignItems:"center",gap:6}}>
            ⏱️ Mínimo 5 horas de locação
          </div>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px"}}>
        <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,fontWeight:700,letterSpacing:1}}>FAÇA SUA RESERVA</div>
        <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
      </div>

      <div id="secaoReserva" style={{padding:"0 16px 16px"}}>
        {QUADRAS.map(q=>(
          <div key={q.id} onClick={()=>{setQuadra(q);setEtapa("horario");}}
            style={{background:"white",borderRadius:14,padding:"18px 16px",marginBottom:12,cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>
            <div style={{width:52,height:52,borderRadius:12,background:q.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
              {q.id==="q1"?"⚽":"🏐"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:17,color:"#1a1f2e"}}>{q.nome}</div>
              <div style={{fontSize:13,color:"#6b7280",marginTop:2}}>{q.tipo}</div>
              {q.cob==="horario" ? (
                <div style={{marginTop:5}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#6b7280"}}>Até 16h: <span style={{color:q.cor}}>R${q.preco}/hora</span></div>
                  <div style={{fontSize:13,fontWeight:700,color:"#6b7280"}}>A partir das 16h: <span style={{color:q.cor}}>R${q.precoNoite}/hora</span></div>
                </div>
              ) : (
                <div style={{fontSize:14,fontWeight:700,color:q.cor,marginTop:5}}>A partir de R${q.preco}/hora</div>
              )}
            </div>
            <div style={{color:"#cbd5e1",fontSize:24}}>›</div>
          </div>
        ))}
      </div>

      <div style={{textAlign:"center",padding:"0 16px 40px"}}>
        <a href={`https://wa.me/${WPP}`}
          style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.1)",color:"white",padding:"12px 24px",borderRadius:30,fontSize:14,fontWeight:600,textDecoration:"none"}}>
          💬 Falar com o Complexo
        </a>
      </div>
    </div>
  );

  // ── TELA HORÁRIO ──
  if (etapa === "horario") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:VE,padding:"16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setEtapa("inicio")} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:18}}>‹</button>
        <div>
          <div style={{fontWeight:700,color:"white",fontSize:16}}>{quadra.nome}</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12}}>{quadra.tipo}</div>
        </div>
      </div>

      <div style={{background:"white",padding:"12px 0",borderBottom:"1px solid #e0e3e8",overflowX:"auto",display:"flex",gap:8,paddingLeft:16,paddingRight:16}}>
        {dias.map((d,i)=>{
          const sel = toDS(d)===toDS(dia);
          return (
            <div key={i} onClick={()=>setDia(d)} style={{flex:"none",textAlign:"center",padding:"8px 14px",borderRadius:10,background:sel?V:"#f4f5f7",cursor:"pointer",minWidth:64}}>
              <div style={{fontSize:11,fontWeight:600,color:sel?"rgba(255,255,255,0.7)":"#6b7280",textTransform:"uppercase"}}>{d.toLocaleDateString("pt-BR",{weekday:"short"})}</div>
              <div style={{fontSize:18,fontWeight:800,color:sel?"white":VE,marginTop:2}}>{d.getDate()}</div>
              <div style={{fontSize:11,color:sel?"rgba(255,255,255,0.7)":"#6b7280"}}>{fd(toDS(d))}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:16,padding:"12px 16px",fontSize:12,color:"#6b7280"}}>
        <span>🟢 Livre</span><span>🟠 Ocupado</span>
      </div>

      <div style={{padding:"0 16px 100px"}}>
        {Array.from({length:30},(_,i)=>i).map(i=>{
          const totalMin = (8*60) + (i*30);
          const hh = Math.floor(totalMin/60).toString().padStart(2,"0");
          const mm = (totalMin%60).toString().padStart(2,"0");
          const hr = `${hh}:${mm}`;
          const totalMinFim = totalMin + 30;
          const hhf = Math.floor(totalMinFim/60).toString().padStart(2,"0");
          const mmf = (totalMinFim%60).toString().padStart(2,"0");
          const hf = `${hhf}:${mmf}`;
          const ocup = isOcupado(hr);
          const sel = slotsSel.includes(hr);
          return (
            <div key={hr} onClick={()=>!ocup && toggleSlot(hr, hf, quadra)}
              style={{display:"flex",alignItems:"center",padding:"14px 16px",borderRadius:10,marginBottom:6,
                cursor:ocup?"not-allowed":"pointer",
                border:`2px solid ${ocup?"#fed7aa":sel?V:"#bbf7d0"}`,
                background:ocup?"#fff7ed":sel?"#dcfce7":"#f0fdf4",
                transition:"all .15s"}}>
              <div style={{fontWeight:700,fontSize:16,minWidth:110,color:ocup?"#9a3412":VE}}>{hr} – {hf}</div>
              <div style={{flex:1,fontSize:14,fontWeight:600,color:ocup?"#9a3412":sel?"#065f46":"#16a34a"}}>
                {ocup ? "🔒 Ocupado" : sel ? "✅ Selecionado" : "Disponível"}
              </div>
              {!ocup && <div style={{fontSize:13,fontWeight:700,color:sel?"#065f46":V}}>
                {quadra.cob==="horario" ? `R$${precoSociety(hr,quadra)}/30min` : quadra.cob==="fixo" ? `R$${(quadra.preco/2).toFixed(0)}/30min` : "Ver valor"}
              </div>}
            </div>
          );
        })}

        {slotsSel.length > 0 && (() => {
          const sorted = [...slotsSel].sort();
          const iniSel = sorted[0];
          const fimSel = toHr(toMin(sorted[sorted.length-1])+30);
          const minutos = slotsSel.length * 30;
          const horas = minutos / 60;
          const valTotal = quadra.cob!=="pessoas" ? calcValorSlots(sorted, quadra) : 0;
          return (
            <div style={{position:"sticky",bottom:16,background:VE,borderRadius:14,padding:"16px",marginTop:10,boxShadow:"0 4px 20px rgba(0,0,0,0.35)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontWeight:800,fontSize:18,color:"white"}}>{iniSel} – {fimSel}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:2}}>
                    {minutos < 60 ? `${minutos} min` : `${horas % 1 === 0 ? horas.toFixed(0) : horas.toFixed(1)}h`}
                    {quadra.cob!=="pessoas" && ` · R$ ${valTotal.toFixed(2)}`}
                  </div>
                </div>
                <button onClick={()=>setSlotsSel([])}
                  style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  Limpar
                </button>
              </div>
              <button onClick={confirmarSlots}
                style={{width:"100%",padding:"15px",background:LA,color:"white",border:"none",borderRadius:10,fontSize:16,fontWeight:800,cursor:"pointer"}}>
                Confirmar horário →
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );

  // ── TELA PESSOAS ──
  if (etapa === "pessoas") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:VE,padding:"16px",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setEtapa("horario")} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:18}}>‹</button>
        <div style={{fontWeight:700,color:"white",fontSize:16}}>Quantas pessoas?</div>
      </div>
      <div style={{padding:24}}>
        <div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40}}>🏐</div>
            <div style={{fontWeight:700,fontSize:18,color:VE,marginTop:8}}>{quadra.nome}</div>
            <div style={{color:"#6b7280",fontSize:14}}>{nomeDia(dia)} · {slot?.ini} às {slot?.fim}</div>
          </div>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Número de pessoas</label>
          <input type="number" min={1} max={60} value={pessoas} onChange={e=>{setPessoas(e.target.value);const v=calcValor(quadra,e.target.value);setValor(v);}}
            style={{width:"100%",padding:"14px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:22,fontWeight:700,textAlign:"center",outline:"none",color:VE}}
            placeholder="0"/>
          {pessoas && parseInt(pessoas)>0 && valor>0 && (
            <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:16,marginTop:12,textAlign:"center"}}>
              <div style={{fontSize:13,color:"#6b7280"}}>{hintPess}</div>
              <div style={{fontWeight:800,fontSize:28,color:VE,marginTop:4}}>R$ {valor.toFixed(2)}</div>
            </div>
          )}
        </div>
        <button onClick={confirmarPessoas} disabled={!pessoas||parseInt(pessoas)<1||valor<=0}
          style={{width:"100%",padding:"16px",background:(!pessoas||parseInt(pessoas)<1||valor<=0)?"#cbd5e1":V,color:"white",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"}}>
          Continuar →
        </button>
      </div>
    </div>
  );

  // ── TELA FORMULÁRIO ──
  if (etapa === "form") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:VE,padding:"16px",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setEtapa(quadra.cob==="pessoas"?"pessoas":"horario")} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:18}}>‹</button>
        <div style={{fontWeight:700,color:"white",fontSize:16}}>Seus dados</div>
      </div>
      <div style={{padding:16}}>
        <div style={{background:"white",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Resumo da Reserva</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:44,height:44,borderRadius:10,background:quadra.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
              {quadra.id==="q1"?"⚽":"🏐"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15}}>{quadra.nome}</div>
              <div style={{fontSize:13,color:"#6b7280"}}>{nomeDia(dia)} · {slot?.ini} às {slot?.fim}</div>
              {pessoas && <div style={{fontSize:13,color:"#6b7280"}}>{pessoas} pessoas</div>}
            </div>
            <div style={{fontWeight:800,fontSize:20,color:VE}}>R${valor.toFixed(0)}</div>
          </div>
        </div>
        <div style={{background:"white",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16}}>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Seu nome *</label>
            <input style={{width:"100%",padding:"12px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:15,outline:"none",color:"#1a1f2e"}} value={nome} onChange={e=>{setNome(e.target.value);setErros(v=>({...v,nome:null}));}} placeholder="Nome e Sobrenome"/>
            {erros.nome && <div style={{color:"#ef4444",fontSize:12,marginTop:4}}>⚠️ {erros.nome}</div>}
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>WhatsApp *</label>
            <input type="tel" style={{width:"100%",padding:"12px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:15,outline:"none",color:"#1a1f2e"}} value={tel} onChange={e=>setTel(e.target.value)} placeholder="(22) 9xxxx-xxxx"/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>CPF (para nota fiscal)</label>
            <input style={{width:"100%",padding:"12px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:15,outline:"none",color:"#1a1f2e"}} value={cpf} onChange={e=>{setCpf(e.target.value);setErros(v=>({...v,cpf:null}));}} placeholder="000.000.000-00"/>
            {erros.cpf && <div style={{color:"#ef4444",fontSize:12,marginTop:4}}>⚠️ {erros.cpf}</div>}
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase"}}>E-MAIL *</label>
            <input type="email" style={{width:"100%",padding:"12px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:15,outline:"none",color:"#1a1f2e"}} value={email} onChange={e=>{setEmail(e.target.value);setErros(v=>({...v,email:null}));}} placeholder="seu@email.com"/>
            {erros.email && <div style={{color:"#ef4444",fontSize:12,marginTop:4}}>⚠️ {erros.email}</div>}
          </div>
          <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setSauna(v=>!v)}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#1a1f2e"}}>🧖 Banho de Sauna</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Disponível Seg–Sex 17h–22h · Sáb 9h–16h</div>
            </div>
            <div style={{width:44,height:24,borderRadius:12,background:sauna?"#2E7D6B":"#e0e3e8",position:"relative",transition:"background .2s",flexShrink:0}}>
              <div style={{position:"absolute",width:18,height:18,borderRadius:"50%",background:"white",top:3,left:sauna?23:3,transition:"left .2s"}}/>
            </div>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Observação (opcional)</label>
            <textarea style={{width:"100%",padding:"12px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:15,outline:"none",resize:"none",color:"#1a1f2e"}} rows={2} value={obs} onChange={e=>setObs(e.target.value)} placeholder="Alguma observação..."/>
          </div>
        </div>
        <button onClick={confirmarReserva} disabled={!nome.trim()||!tel.trim()}
          style={{width:"100%",padding:"16px",background:(!nome.trim()||!tel.trim())?"#cbd5e1":V,color:"white",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:12}}>
          Ir para o pagamento →
        </button>
      </div>
    </div>
  );

  // ── TELA REGRAS ──
  if (etapa === "regras") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:VE,padding:"16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setEtapa("form")} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:18}}>‹</button>
        <div style={{fontWeight:700,color:"white",fontSize:16}}>Regras de Uso</div>
      </div>
      <div style={{padding:16}}>
        <div style={{background:"white",borderRadius:14,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,.08)",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:quadra.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
            {quadra.id==="q1"?"⚽":"🏐"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>{quadra.nome} · {nomeDia(dia)}</div>
            <div style={{fontSize:13,color:"#6b7280"}}>{slot?.ini} às {slot?.fim} · {nome}</div>
          </div>
          <div style={{fontWeight:800,fontSize:18,color:VE}}>R${valor.toFixed(0)}</div>
        </div>

        <div style={{background:"white",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,.08)",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:VE}}>📋 Leia com atenção antes de confirmar</div>
          {(quadra?.id==="q2" ? REGRAS_AREIA : REGRAS_SOCIETY).map((r,i)=>{
            if(r.tipo==="header") return(
              <div key={i} style={{background:r.titulo.startsWith("🏖️")?"#fff7ed":"#fffbeb",borderRadius:10,padding:"10px 14px",margin:"14px 0 8px",fontWeight:800,fontSize:14,color:r.titulo.startsWith("🏖️")?"#9a3412":"#92400e"}}>
                {r.titulo}
              </div>
            );
            return(
              <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid #f3f4f6"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:VE,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0,marginTop:1}}>{r.num}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1a1f2e",marginBottom:4}}>{r.titulo}</div>
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{r.texto}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1a1f2e",marginBottom:10}}>💳 Quanto deseja pagar agora?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[[50,"50% agora",`R$${(valor*0.5).toFixed(2)}`,"Restante na chegada"],[100,"100% agora",`R$${valor.toFixed(2)}`,"Pago total"]].map(([p,titulo,val,sub])=>(
              <div key={p} onClick={()=>setPorcPag(p)}
                style={{border:`2px solid ${porcPag===p?V:"#e0e3e8"}`,borderRadius:12,padding:"14px 12px",cursor:"pointer",background:porcPag===p?"#f0fdf4":"white",textAlign:"center",transition:"all .15s"}}>
                <div style={{fontWeight:800,fontSize:16,color:porcPag===p?VE:"#1a1f2e"}}>{titulo}</div>
                <div style={{fontWeight:700,fontSize:20,color:porcPag===p?V:"#374151",margin:"4px 0"}}>{val}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{sub}</div>
                {porcPag===p&&<div style={{fontSize:18,marginTop:4}}>✓</div>}
              </div>
            ))}
          </div>
        </div>

        <div onClick={()=>setCiente(v=>!v)} style={{background:ciente?"#f0fdf4":"white",border:`2px solid ${ciente?V:"#e0e3e8"}`,borderRadius:14,padding:16,marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"all .2s"}}>
          <div style={{width:28,height:28,borderRadius:8,background:ciente?V:"#f3f4f6",border:`2px solid ${ciente?V:"#d1d5db"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
            {ciente&&<span style={{color:"white",fontSize:16,fontWeight:700}}>✓</span>}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:ciente?VE:"#374151"}}>Li e concordo com as regras</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Ao concluir a reserva, declaro estar ciente e de acordo com as regras acima</div>
          </div>
        </div>

        <button onClick={confirmarRegras} disabled={!ciente||loadingPag}
          style={{width:"100%",padding:"16px",background:(!ciente||loadingPag)?"#e0e3e8":V,color:(!ciente||loadingPag)?"#9ca3af":"white",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:(!ciente||loadingPag)?"not-allowed":"pointer",transition:"all .2s"}}>
          {loadingPag ? "⏳ Gerando pagamento..." : ciente ? `Pagar R$${(valor*(porcPag/100)).toFixed(2)} →` : "Marque que está de acordo para continuar"}
        </button>
      </div>
    </div>
  );

  // ── TELA PIX ──
  if (etapa === "pix") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:VE,padding:"16px",textAlign:"center"}}>
        <div style={{fontWeight:700,color:"white",fontSize:16}}>Pagamento via Pix</div>
      </div>
      <div style={{padding:16}}>
        <div style={{background:"white",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:10,background:quadra.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
            {quadra.id==="q1"?"⚽":"🏐"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15}}>{quadra.nome}</div>
            <div style={{fontSize:13,color:"#6b7280"}}>{nomeDia(dia)} · {slot?.ini} às {slot?.fim}</div>
          </div>
          <div style={{fontWeight:800,fontSize:20,color:VE}}>R${(valor*(porcPag/100)).toFixed(2)}</div>
        </div>

        {dadosPix ? (
          <div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>Escaneie o QR code ou copie o código</div>
            {dadosPix.qrCodeBase64 && (
              <img src={`data:image/png;base64,${dadosPix.qrCodeBase64}`} alt="QR Code Pix" style={{width:200,height:200,margin:"0 auto 16px",display:"block"}}/>
            )}
            <div style={{background:"#f0fdf4",border:"2px dashed #2E7D6B",borderRadius:12,padding:14,marginBottom:12,wordBreak:"break-all",fontSize:13,color:"#1a1f2e"}}>
              {dadosPix.qrCode}
            </div>
            <button onClick={()=>navigator.clipboard?.writeText(dadosPix.qrCode)}
              style={{width:"100%",padding:"14px",background:"#f0fdf4",border:"1.5px solid #2E7D6B",borderRadius:10,fontSize:15,fontWeight:700,color:"#2E7D6B",cursor:"pointer",marginBottom:8}}>
              📋 Copiar código Pix
            </button>
            <div style={{fontSize:12,color:"#6b7280"}}>Após pagar, aguarde a confirmação automática</div>
          </div>
        ) : (
          <div style={{background:"white",borderRadius:14,padding:20,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:40,marginBottom:8}}>📱</div>
            <div style={{fontWeight:700,fontSize:16}}>Gerando Pix...</div>
          </div>
        )}

        <div style={{textAlign:"center"}}>
          <a href={`https://wa.me/${WPP}?text=Olá! Tive um problema na reserva da ${quadra?.nome}.`}
            style={{display:"inline-flex",alignItems:"center",gap:6,color:"#6b7280",fontSize:13,textDecoration:"none"}}>
            💬 Tive um problema — falar com o Complexo
          </a>
        </div>
      </div>
    </div>
  );

  // ── TELA CONFIRMADO ──
  if (etapa === "confirmado") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:VE,minHeight:"100vh",maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:80,marginBottom:12}}>{quadra?.id==="q1"?"⚽":"🏐"}</div>
        <div style={{fontWeight:800,fontSize:28,color:"white",marginBottom:8}}>Quadra Reservada!</div>
        <div style={{color:"rgba(255,255,255,0.7)",fontSize:15}}>Bom jogo! Até lá no Complexo Melodia 🏟️</div>
      </div>
      <div style={{background:"rgba(255,255,255,0.12)",borderRadius:16,padding:20,width:"100%",marginBottom:20}}>
        {[
          ["📅 Data",nomeDia(dia)],
          ["🕐 Horário",`${slot?.ini} às ${slot?.fim}`],
          ["👤 Nome",nome],
          ["📱 WhatsApp",tel],
          ["💰 Pago agora",`R$ ${(valor*(porcPag/100)).toFixed(2)}${porcPag===50?" (50%)":""}`],
          ...(porcPag===50?[["⏳ Na chegada",`R$ ${(valor*0.5).toFixed(2)}`]]:[]),
          ...(sauna?[["🧖 Sauna","Confirmada"]]:[[]])
        ].filter(x=>x[0]).map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
            <span style={{color:"rgba(255,255,255,0.6)",fontSize:14}}>{l}</span>
            <span style={{color:"white",fontWeight:600,fontSize:14}}>{v}</span>
          </div>
        ))}
      </div>
      <button onClick={()=>{setEtapa("inicio");setQuadra(null);setSlot(null);setPessoas("");setNome("");setTel("");setObs("");setValor(0);setSauna(false);setPorcPag(100);setCpf("");setDadosPix(null);}}
        style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",padding:"14px 24px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>
        Fazer outra reserva
      </button>
    </div>
  );

  return null;
}
