import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI",
  authDomain: "agendamento-quadras-ad13b.firebaseapp.com",
  projectId: "agendamento-quadras-ad13b",
  storageBucket: "agendamento-quadras-ad13b.firebasestorage.app",
  messagingSenderId: "228136379926",
  appId: "1:228136379926:web:7741e85184909b1ecff737"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const VE = "#1a5248";
const SENHA = "melodia123";
const SAUNA_UNIT = 15;

function hoje() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}
function toDS(d) { return d.toISOString().split("T")[0]; }
function toHr(min) { return Math.floor(min/60).toString().padStart(2,"0")+":"+(min%60).toString().padStart(2,"0"); }
function toMin(hr) { const[h,m]=hr.split(":").map(Number); return h*60+m; }

// ============================================================
// MODELO FINANCEIRO ÚNICO E SIMPLES
// ============================================================
// - 'val'        = valor BASE da quadra para a duração ATUAL (sempre recalculado)
// - 'valPago'    = soma de TUDO que já foi efetivamente recebido (online + balcão)
// - 'pagoOnline' = quanto foi pago pelo site (não muda depois de criado)
//
// Falta receber = (val + sauna + excedente) - valPago
// Ao cobrar no balcão: valPago += faltaReceber (zera tudo de uma vez)

// Quanto foi pago pelo site no momento da reserva (não muda depois)
// Compatibilidade: se 'pagOriginal' não existir, usa 'pag' atual.
function pagoOnline(ag) {
  if(!ag) return 0;
  const val = parseFloat(ag.val)||0;
  const pag = ag.pagOriginal || ag.pag || "";
  if(["mp_pix","mp_cartao","mp_total"].includes(pag)) return val;
  if(pag==="mp_50") return val*0.5;
  return 0;
}

// Quanto já foi recebido em MÁQUINA (cartão) no balcão
function pagoMaquina(ag) {
  return parseFloat(ag?.pagoMaquina)||0;
}

// Quanto já foi recebido em DINHEIRO no balcão
function pagoDinheiro(ag) {
  return parseFloat(ag?.pagoDinheiro)||0;
}

// Total já recebido (online + máquina + dinheiro)
// Compatibilidade: se os campos novos não existirem (reservas antigas),
// infere a partir do campo 'pag' antigo.
function totalJaPago(ag) {
  if(ag?.pagoMaquina !== undefined || ag?.pagoDinheiro !== undefined) {
    return pagoOnline(ag) + pagoMaquina(ag) + pagoDinheiro(ag);
  }
  const val = parseFloat(ag?.val)||0;
  const pag = ag?.pag||"";
  if(["mp_pix","mp_cartao","mp_total","mp_total_pix","mp_total_cartao","mp_total_dinheiro"].includes(pag)) return val;
  if(pag==="mp_50") return val*0.5;
  return 0;
}

// Valor da quadra para a duração atual (sempre = campo 'val')
function valorQuadraAtual(ag) {
  return parseFloat(ag?.val)||0;
}

// Valor da sauna no momento atual
function valorSaunaAtual(ag) {
  const qtd = parseInt(ag?.saunaQtd)||0;
  return qtd * SAUNA_UNIT;
}

// Valor do excedente no momento atual
const AREIA_LIMITE_SEM_EXTRA = 12;
const AREIA_PRECO_EXCEDENTE = 10;
function valorExcedente(ag, pessPresentes) {
  if(!ag || ag.qid!=="q2") return 0;
  const presentes = parseInt(pessPresentes)||0;
  if(presentes <= AREIA_LIMITE_SEM_EXTRA) return 0;
  const excedentes = presentes - AREIA_LIMITE_SEM_EXTRA;
  if(!ag.ini||!ag.fim) return 0;
  const minutos = toMin(ag.fim) - toMin(ag.ini);
  const horas = Math.floor(minutos/60);
  if(horas < 1) return 0;
  return excedentes * AREIA_PRECO_EXCEDENTE * horas;
}

// Valor TOTAL devido agora (quadra + sauna + excedente)
function valorTotalDevido(ag, pessPresentes) {
  return valorQuadraAtual(ag) + valorSaunaAtual(ag) + valorExcedente(ag, pessPresentes);
}

// Quanto falta receber AGORA
function faltaReceber(ag, pessPresentes) {
  const falta = valorTotalDevido(ag, pessPresentes) - totalJaPago(ag);
  return falta < 0.01 ? 0 : falta;
}

function isPagoOnline(pag) {
  return ["mp_pix","mp_cartao","mp_total","mp_50"].includes(pag||"");
}
function isPagoPresencial(pag) {
  return ["mp_total_pix","mp_total_cartao","mp_total_dinheiro","mp_total_misto"].includes(pag||"");
}
function tocarSom(tipo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(tipo === "aviso") {
      // Som discreto: 2 bipes curtos
      [0, 0.3].forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime+t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.2);
        osc.start(ctx.currentTime+t);
        osc.stop(ctx.currentTime+t+0.2);
      });
    } else {
      // Som principal: 3 bipes mais fortes
      [0, 0.4, 0.8].forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.5, ctx.currentTime+t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.3);
        osc.start(ctx.currentTime+t);
        osc.stop(ctx.currentTime+t+0.3);
      });
    }
    // Vibração no celular
    if(navigator.vibrate) {
      tipo === "aviso" ? navigator.vibrate([200,100,200]) : navigator.vibrate([400,200,400,200,400]);
    }
  } catch(e) {}
}

function Login({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  function tentar() {
    if(senha===SENHA) onLogin();
    else { setErro(true); setSenha(""); }
  }
  return (
    <div style={{minHeight:"100vh",background:VE,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:16}}>
      <div style={{background:"white",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <div style={{fontWeight:900,fontSize:22,color:"#1a1f2e"}}>Área da Funcionária</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>Complexo Melodia</div>
        </div>
        <div style={{marginBottom:14}}>
          <input type="password" value={senha}
            onChange={e=>{setSenha(e.target.value);setErro(false);}}
            onKeyDown={e=>e.key==="Enter"&&tentar()}
            placeholder="Digite a senha"
            style={{width:"100%",padding:"12px 14px",border:`2px solid ${erro?"#ef4444":"#e0e3e8"}`,borderRadius:10,fontSize:15,outline:"none",boxSizing:"border-box"}}
            autoFocus/>
          {erro && <div style={{color:"#ef4444",fontSize:12,marginTop:6}}>Senha incorreta.</div>}
        </div>
        <button onClick={tentar}
          style={{width:"100%",padding:"13px",background:VE,color:"white",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>
          Entrar
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [logado, setLogado] = useState(()=>sessionStorage.getItem("func_auth")==="1");
  const [dia, setDia] = useState(hoje());
  const [agendamentos, setAgendamentos] = useState([]);
  const [hora, setHora] = useState(new Date());
  const [modalPag, setModalPag] = useState(null);
  const [edicoes, setEdicoes] = useState({});
  const [alarme, setAlarme] = useState(null);
  const [aviso5min, setAviso5min] = useState(null);
  const [toast, setToast] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalMisto, setModalMisto] = useState(false);
  const [mistoMaq, setMistoMaq] = useState("");
  const [mistoDin, setMistoDin] = useState("");
  const [recebidoMaquina, setRecebidoMaquina] = useState(0);
  const [recebidoDinheiro, setRecebidoDinheiro] = useState(0);
  const [filtro, setFiltro] = useState("todos");

  useEffect(()=>{
    if(!logado) return;
    try {
      const unsub = onSnapshot(
        query(collection(db,"agendamentos"), where("st","!=","cancelado")),
        snap=>{ setAgendamentos(snap.docs.map(d=>({id:d.id,...d.data()}))); }
      );
      return ()=>unsub();
    } catch(e) {}
  },[logado]);

  useEffect(()=>{
    const t = setInterval(()=>setHora(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  // Recalcular máquina e dinheiro — soma direta dos acumuladores
  useEffect(()=>{
    if(!logado) return;
    const agsDia = agendamentos.filter(a=>a.data===dia&&a.st==="confirmado");
    let maq=0, din=0;
    agsDia.forEach(a=>{
      const agE = {...a,...(edicoes[a.id]||{})};
      maq += pagoMaquina(agE);
      din += pagoDinheiro(agE);
    });
    setRecebidoMaquina(maq);
    setRecebidoDinheiro(din);
  },[agendamentos,edicoes,dia,logado]);

  // Alarme fim de jogo + aviso 5 minutos antes
  useEffect(()=>{
    if(!logado) return;
    const agsDia = agendamentos.filter(a=>a.data===dia&&a.st==="confirmado");
    for(const ag of agsDia){
      const agE = getAg(ag.id);
      const fim = agE.fim||ag.fim;
      if(!fim) continue;
      const fimMs = new Date();
      const[fH,fM]=fim.split(":").map(Number);
      fimMs.setHours(fH,fM,0,0);
      const diff = fimMs-hora;
      // Aviso 5 minutos antes (entre 5min e 4min59s)
      if(diff>240000&&diff<=300000&&aviso5min?.id!==ag.id) {
        setAviso5min(ag);
        tocarSom("aviso");
      }
      // Alarme principal no fim (últimos 60s)
      if(diff>0&&diff<=60000&&alarme?.id!==ag.id) {
        setAlarme(ag);
        tocarSom("principal");
      }
    }
  },[hora,agendamentos,dia,logado]);

  if(!logado) return <Login onLogin={()=>{sessionStorage.setItem("func_auth","1");setLogado(true);}}/>;

  function getAg(id) {
    const ag = agendamentos.find(x=>x.id===id);
    return {...ag,...(edicoes[id]||{})};
  }
  function getPP(ag) {
    if(edicoes[ag.id]?.pessPresentes!==undefined) return parseInt(edicoes[ag.id].pessPresentes)||0;
    if(ag.pessPresentes!==undefined) return parseInt(ag.pessPresentes)||0;
    return parseInt(ag.pess)||0;
  }

  async function confirmarPag(id, tipo) {
    setModalPag(null);
    try {
      const agE = getAg(id);
      const pp = getPP(agE);
      const falta = faltaReceber(agE, pp);
      const update = { pag: tipo };
      // Soma o valor pendente no acumulador correto (máquina ou dinheiro)
      if(tipo === "mp_total_cartao") update.pagoMaquina = pagoMaquina(agE) + falta;
      else if(tipo === "mp_total_dinheiro") update.pagoDinheiro = pagoDinheiro(agE) + falta;
      // Preserva o registro do pagamento original (1ª vez que cobra no balcão)
      if(agE.pagOriginal === undefined) {
        update.pagOriginal = agE.pag || "pendente";
      }
      await updateDoc(doc(db,"agendamentos",id),update);
      setEdicoes(p=>({...p,[id]:{...p[id],...update}}));
      setAgendamentos(prev=>prev.map(a=>a.id===id?{...a,...update}:a));
      setToast("✅ R$ "+falta.toFixed(2)+" recebido!");
      setTimeout(()=>setToast(""), 3000);
    } catch(e) {
      alert("Erro ao registrar pagamento: "+e.message);
    }
  }

  async function confirmarPagMisto(id, valMaq, valDin) {
    setModalPag(null);
    try {
      const agE = getAg(id);
      const update = {
        pagoMaquina: pagoMaquina(agE) + valMaq,
        pagoDinheiro: pagoDinheiro(agE) + valDin,
        pag: valMaq>0 && valDin>0 ? "mp_total_misto" : valMaq>0 ? "mp_total_cartao" : "mp_total_dinheiro",
      };
      if(agE.pagOriginal === undefined) {
        update.pagOriginal = agE.pag || "pendente";
      }
      await updateDoc(doc(db,"agendamentos",id),update);
      setEdicoes(p=>({...p,[id]:{...p[id],...update}}));
      setAgendamentos(prev=>prev.map(a=>a.id===id?{...a,...update}:a));
      const total = valMaq+valDin;
      setToast("✅ R$ "+total.toFixed(2)+" recebido!");
      setTimeout(()=>setToast(""), 3000);
    } catch(e) {
      alert("Erro ao registrar pagamento: "+e.message);
    }
  }
  async function desfazerPag(id) {
    if(!window.confirm("Desfazer recebimento?")) return;
    const agE = getAg(id);
    const update = {pag: agE.pagOriginal||"pendente", pagoMaquina:0, pagoDinheiro:0};
    setEdicoes(p=>({...p,[id]:{...p[id],...update}}));
    setAgendamentos(prev=>prev.map(a=>a.id===id?{...a,...update}:a));
    try { await updateDoc(doc(db,"agendamentos",id),update); } catch(e){}
  }
  async function salvarPP(id, qtd) {
    const val = Math.max(0, qtd);
    setEdicoes(p=>({...p,[id]:{...p[id],pessPresentes:val}}));
    try { await updateDoc(doc(db,"agendamentos",id),{pessPresentes:val}); } catch(e){}
  }
  async function salvarSaunaQtd(id, qtd) {
    const val = Math.max(0, qtd);
    setEdicoes(p=>({...p,[id]:{...p[id],saunaQtd:val}}));
    try { await updateDoc(doc(db,"agendamentos",id),{saunaQtd:val}); } catch(e){}
  }
  async function adicionarTempo(id, mins) {
    const agE = getAg(id);
    const fimAtual = agE.fim || agendamentos.find(x=>x.id===id)?.fim || "";
    const iniAtual = agE.ini || agendamentos.find(x=>x.id===id)?.ini || "";
    const qid = agE.qid || agendamentos.find(x=>x.id===id)?.qid || "";
    const novoFimMin = toMin(fimAtual) + mins;
    if(novoFimMin < toMin(iniAtual)+30) {
      alert("Não é possível reduzir abaixo de 30 minutos.");
      return;
    }
    const novoFim = toHr(novoFimMin);
    if(mins > 0) {
      const conflito = agendamentos.some(x=>
        x.id!==id && x.qid===qid && x.data===agE.data &&
        x.st==="confirmado" && x.ini>=fimAtual && x.ini<novoFim
      );
      if(conflito) { alert("⚠️ Horário seguinte já está ocupado!"); return; }
    }
    // Confirmação antes de aplicar a mudança
    const label = mins>0 ? "+"+(mins===60?"1h":"30min") : (mins===-60?"-1h":"-30min");
    if(!window.confirm("Alterar para "+label+"?\\n\\nNovo horário: "+iniAtual+" às "+novoFim)) return;
    // Recalcula o valor da quadra para a nova duração (do zero, sempre)
    const duracaoNovaMin = novoFimMin - toMin(iniAtual);
    let novoVal;
    if(qid==="q1") {
      const precoHora = iniAtual>="16:00" ? 130 : 120;
      novoVal = parseFloat((precoHora*(duracaoNovaMin/60)).toFixed(2));
    } else {
      novoVal = parseFloat((60*(duracaoNovaMin/60)).toFixed(2)); // Areia: R$60/h até 12 pessoas
    }
    const update = {fim:novoFim, val:novoVal};
    setEdicoes(p=>({...p,[id]:{...p[id],...update}}));
    setAgendamentos(prev=>prev.map(a=>a.id===id?{...a,...update}:a));
    try { await updateDoc(doc(db,"agendamentos",id),update); } catch(e){}
  }

  const agsDia = agendamentos
    .filter(a=>a.data===dia&&a.st==="confirmado"&&(filtro==="todos"||a.qid===(filtro==="society"?"q1":"q2")))
    .sort((a,b)=>a.ini.localeCompare(b.ini));

  // Total falta receber no balcão
  const totalFalta = agsDia.reduce((s,a)=>{
    const agE = getAg(a.id);
    const pp = getPP(agE);
    return s + faltaReceber(agE, pp);
  },0);

  function mudarDia(dir) {
    const d = new Date(dia+"T12:00:00");
    d.setDate(d.getDate()+dir);
    setDia(toDS(d));
  }
  function nomeDia(ds) {
    const d = new Date(ds+"T12:00:00");
    const hj = hoje();
    if(ds===hj) return "Hoje";
    const am = new Date(hj+"T12:00:00");
    am.setDate(am.getDate()+1);
    if(ds===toDS(am)) return "Amanhã";
    return d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
  }

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:"#f0f4f8",minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>

      {/* AVISO 5 MINUTOS */}
      {aviso5min && (
        <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",zIndex:500,maxWidth:480,width:"100%",padding:"0 12px",paddingTop:8}}>
          <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>
            <div>
              <div style={{fontWeight:800,fontSize:14,color:"#92400e"}}>⏰ Faltam 5 minutos!</div>
              <div style={{fontSize:13,color:"#92400e",marginTop:2}}>{aviso5min.cli} — termina às {getAg(aviso5min.id).fim||aviso5min.fim}</div>
            </div>
            <button onClick={()=>setAviso5min(null)}
              style={{background:"#f59e0b",border:"none",color:"white",borderRadius:8,padding:"6px 12px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* ALARME */}
      {alarme && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"white",borderRadius:20,padding:28,maxWidth:340,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>⏰</div>
            <div style={{fontWeight:800,fontSize:20,color:"#1a1f2e",marginBottom:8}}>FIM DO JOGO</div>
            <div style={{color:"#6b7280",marginBottom:20}}>{alarme.cli} — {alarme.ini} às {alarme.fim}</div>
            <button onClick={()=>setAlarme(null)}
              style={{width:"100%",padding:14,background:VE,color:"white",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"}}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:VE,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"white"}}>COMPLEXO MELODIA</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Painel da Funcionária</div>
        </div>
        <div style={{color:"rgba(255,255,255,0.8)",fontSize:15,fontWeight:700}}>
          {hora.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>

      {/* NAVEGAÇÃO DE DIA */}
      <div style={{background:VE,padding:"0 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>mudarDia(-1)}
          style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,fontSize:20,cursor:"pointer"}}>‹</button>
        <div style={{color:"white",fontWeight:700,fontSize:14,textTransform:"capitalize"}}>{nomeDia(dia)}</div>
        <button onClick={()=>mudarDia(1)}
          style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,fontSize:20,cursor:"pointer"}}>›</button>
      </div>

      {/* FILTRO */}
      <div style={{background:"#f0f4f8",padding:"10px 16px 4px",display:"flex",gap:8}}>
        {[["todos","Todos"],["society","⚽ Society"],["areia","🏐 Areia"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFiltro(k)}
            style={{flex:1,padding:"8px 4px",borderRadius:20,border:"none",background:filtro===k?(k==="society"?VE:k==="areia"?"#E8861A":"#374151"):"#e2e8f0",color:filtro===k?"white":"#6b7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {/* PAINEL SUPERIOR */}
      <div style={{background:VE,padding:"0 16px 14px"}}>

        {/* DESTAQUE PRINCIPAL */}
        <div style={{background:totalFalta>0?"rgba(253,230,138,0.15)":"rgba(134,239,172,0.15)",border:`2px solid ${totalFalta>0?"#fde68a":"#86efac"}`,borderRadius:14,padding:"16px",marginBottom:10,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:totalFalta>0?"#fde68a":"#86efac",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>
            {totalFalta>0?"💰 FALTA RECEBER NO BALCÃO":"✅ TUDO RECEBIDO"}
          </div>
          <div style={{fontWeight:900,fontSize:36,color:totalFalta>0?"#fde68a":"#86efac"}}>
            {totalFalta>0?`R$ ${totalFalta.toFixed(2)}`:"R$ 0,00"}
          </div>
        </div>

        {/* MÁQUINA E DINHEIRO */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          {[
            {label:"💳 Máquina", val:recebidoMaquina},
            {label:"💵 Dinheiro", val:recebidoDinheiro},
          ].map(({label,val})=>(
            <div key={label} style={{background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4}}>{label}</div>
              <div style={{fontWeight:800,fontSize:16,color:"white"}}>R$ {val.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* BOTÃO FECHAMENTO DO DIA */}
        <button onClick={()=>{
            if(totalFalta>0.01){ alert("🔒 Existem R$ "+totalFalta.toFixed(2)+" pendentes de cobrança.\n\nQuite todas as reservas antes de fechar o caixa."); return; }
            setModalFechamento(true);
          }}
          style={{width:"100%",padding:"10px",background:totalFalta>0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.1)",border:"1.5px solid rgba(255,255,255,0.25)",borderRadius:10,color:totalFalta>0?"rgba(255,255,255,0.5)":"white",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:10}}>
          {totalFalta>0 ? "🔒 Fechamento do dia (pendências)" : "📋 Fechamento do dia"}
        </button>

        {/* PRÓXIMA SAUNA */}
        {(()=>{
          const agoraMin2 = hora.getHours()*60+hora.getMinutes();
          const proxSauna = agsDia.find(a=>{
            const agE2 = getAg(a.id);
            return (parseInt(agE2.saunaQtd)||0)>0 && toMin(a.ini)>=agoraMin2;
          });
          if(!proxSauna) return null;
          const agE2 = getAg(proxSauna.id);
          const qtd = parseInt(agE2.saunaQtd)||0;
          return (
            <div style={{background:"rgba(255,220,100,0.15)",border:"1px solid rgba(255,220,100,0.3)",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#fde68a",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🔥 Próxima Sauna</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:800,color:"white",fontSize:15}}>{proxSauna.ini}</div>
                  <div style={{color:"rgba(255,255,255,0.7)",fontSize:13}}>{proxSauna.cli}</div>
                </div>
                <div style={{color:"#fde68a",fontWeight:700,fontSize:14}}>{qtd} pessoa{qtd!==1?"s":""}</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* LISTA DE RESERVAS */}
      <div style={{padding:"12px 12px"}}>
        {agsDia.length===0 ? (
          <div style={{textAlign:"center",padding:32,color:"#6b7280"}}>
            <div style={{fontSize:40,marginBottom:12}}>📅</div>
            <div style={{fontWeight:600}}>Nenhuma reserva confirmada</div>
          </div>
        ) : agsDia.map(a=>{
          const agE = getAg(a.id);
          const pp = getPP(agE);
          const agendadas = parseInt(agE.pess)||0;
          const saunaQtd = parseInt(agE.saunaQtd)||0;
          const saunaVal = saunaQtd * SAUNA_UNIT;
          const excVal = valorExcedente(agE, pp);
          const excQtd = Math.max(0, pp - 12);
          const cobrar = faltaReceber(agE, pp);
          const agoraMin = hora.getHours()*60+hora.getMinutes();
          const iniMin = toMin(a.ini);
          const fimMin = toMin(agE.fim||a.fim);
          const emAndamento = agoraMin>=iniMin&&agoraMin<fimMin;
          const encerrada = agoraMin>=fimMin;
          const qNome = agE.qid==="q2" ? "🏐 Quadra de Areia" : "⚽ Campo Society";
          const qCor = agE.qid==="q2" ? "#E8861A" : VE;
          // Cor de status temporal (borda superior)
          const corStatus = emAndamento ? "#16a34a" : encerrada ? "#9ca3af" : "#f59e0b";

          return (
            <div key={a.id} style={{marginBottom:10,background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 3px 12px rgba(0,0,0,.08)",borderLeft:`4px solid ${agE.qid==="q2"?"#E8861A":VE}`,borderTop:`3px solid ${corStatus}`}}>
              <div style={{padding:"14px 16px"}}>

                {/* Cabeçalho do card */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  <div style={{display:"inline-flex",alignItems:"center",background:qCor,borderRadius:20,padding:"3px 12px"}}>
                    <span style={{fontSize:12,fontWeight:700,color:"white"}}>{qNome}</span>
                  </div>
                  {emAndamento && (
                    <div style={{display:"inline-flex",alignItems:"center",background:"#16a34a",borderRadius:20,padding:"3px 12px"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"white"}}>🟢 EM ANDAMENTO</span>
                    </div>
                  )}
                </div>

                <div style={{fontWeight:800,fontSize:17,color:"#1a1f2e",textTransform:"uppercase",marginBottom:4}}>
                  {agE.cli||a.cli}
                </div>

                {(agE.tel||a.tel) && (
                  <a href={`https://wa.me/55${(agE.tel||a.tel).replace(/\D/g,"")}`} target="_blank"
                    style={{display:"block",fontSize:13,color:"#16a34a",marginBottom:6,textDecoration:"none",fontWeight:600}}>
                    📞 {agE.tel||a.tel} 💬
                  </a>
                )}

                {/* Horário em destaque + status */}
                <div style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontWeight:900,fontSize:22,color:"#1a1f2e",marginBottom:4}}>
                    ⏰ {agE.ini||a.ini} às {agE.fim||a.fim}
                    {agE.fim && agE.fim!==a.fim && (
                      <span style={{fontSize:11,color:"#1e40af",fontWeight:700,marginLeft:8,background:"#eff6ff",padding:"2px 8px",borderRadius:20,verticalAlign:"middle"}}>
                        atualizado
                      </span>
                    )}
                  </div>
                  {(()=>{
                    const isHoje = dia === hoje();
                    const now = hora.getHours()*60+hora.getMinutes();
                    const ini2 = toMin(agE.ini||a.ini);
                    const fim2 = toMin(agE.fim||a.fim);
                    // Só mostrar contador no dia atual
                    if(!isHoje) {
                      return (
                        <div style={{fontSize:13,fontWeight:600,color:"#6b7280",background:"#f3f4f6",borderRadius:6,padding:"3px 8px",display:"inline-block"}}>
                          📅 {agE.ini||a.ini} às {agE.fim||a.fim}
                        </div>
                      );
                    }
                    if(now < ini2) {
                      const diff = ini2 - now;
                      const h = Math.floor(diff/60), m = diff%60;
                      const urgente = diff <= 15;
                      return (
                        <div style={{fontSize:13,fontWeight:700,color:urgente?"#d97706":"#6b7280",background:urgente?"#fef3c7":"transparent",borderRadius:6,padding:urgente?"3px 8px":"0",display:"inline-block"}}>
                          ⏰ Faltam {h>0?h+"h ":""}{m>0?m+"min":""} para a reserva
                        </div>
                      );
                    }
                    if(now >= ini2 && now < fim2) {
                      const restam = fim2 - now;
                      const h = Math.floor(restam/60), m = restam%60;
                      return (
                        <div style={{fontSize:13,fontWeight:700,color:"#16a34a",background:"#dcfce7",borderRadius:6,padding:"3px 8px",display:"inline-block"}}>
                          🟢 Em andamento — restam {h>0?h+"h ":""}{m>0?m+"min":""}
                        </div>
                      );
                    }
                    return (
                      <div style={{fontSize:13,fontWeight:600,color:"#9ca3af",background:"#f3f4f6",borderRadius:6,padding:"3px 8px",display:"inline-block"}}>
                        ✅ Encerrada
                      </div>
                    );
                  })()}
                </div>

                {/* ── PERGUNTA 1: Mais pessoas? (só Areia) ── */}
                {agE.qid==="q2" && (
                  <div style={{background:"#f0f9ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"12px",marginBottom:10}}>
                    <div style={{fontSize:12,color:"#1e40af",fontWeight:700,marginBottom:2}}>👥 Total de pessoas na área exclusiva</div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:10}}>(quadra, deck e churrasqueira)</div>
                    {/* Comparação agendadas vs presentes */}
                    <div style={{display:"flex",gap:12,marginBottom:10,fontSize:13}}>
                      <div style={{background:"#e0f2fe",borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                        <div style={{color:"#0369a1",fontWeight:600}}>Agendadas</div>
                        <div style={{fontWeight:900,fontSize:18,color:"#0369a1"}}>{agendadas}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",color:"#6b7280",fontSize:16}}>→</div>
                      <div style={{background:excQtd>0?"#fee2e2":"#f0f9ff",borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                        <div style={{color:excQtd>0?"#dc2626":"#0369a1",fontWeight:600}}>Presentes</div>
                        <div style={{fontWeight:900,fontSize:18,color:excQtd>0?"#dc2626":"#0369a1"}}>{pp}</div>
                      </div>
                      {excQtd>0 && (
                        <div style={{background:"#fee2e2",borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                          <div style={{color:"#dc2626",fontWeight:600}}>Excedentes</div>
                          <div style={{fontWeight:900,fontSize:18,color:"#dc2626"}}>+{excQtd}</div>
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <button onClick={()=>salvarPP(a.id, pp-1)}
                        style={{width:36,height:36,borderRadius:8,border:"1.5px solid #1e40af",background:"white",color:"#1e40af",fontWeight:800,fontSize:22,cursor:"pointer"}}>−</button>
                      <span style={{fontWeight:900,fontSize:28,color:"#1e40af",minWidth:36,textAlign:"center"}}>{pp}</span>
                      <button onClick={()=>salvarPP(a.id, pp+1)}
                        style={{width:36,height:36,borderRadius:8,border:"1.5px solid #1e40af",background:"#1e40af",color:"white",fontWeight:800,fontSize:22,cursor:"pointer"}}>+</button>
                      {excQtd>0 && (
                        <span style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>
                          = R$ {excVal.toFixed(2)} a mais
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PERGUNTA 2: Vai usar sauna? ── */}
                <div style={{background:saunaQtd>0?"#f0fdf4":"#f9fafb",border:`1px solid ${saunaQtd>0?"#bbf7d0":"#e0e3e8"}`,borderRadius:10,padding:"12px",marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>🧖 Vai usar sauna?</div>
                  <div style={{display:"flex",gap:8,marginBottom:saunaQtd>0?10:0}}>
                    <button onClick={()=>salvarSaunaQtd(a.id,0)}
                      style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${saunaQtd===0?"#6b7280":"#e0e3e8"}`,background:saunaQtd===0?"#374151":"white",color:saunaQtd===0?"white":"#374151",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                      Não
                    </button>
                    <button onClick={()=>salvarSaunaQtd(a.id, saunaQtd>0?saunaQtd:1)}
                      style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${saunaQtd>0?"#16a34a":"#e0e3e8"}`,background:saunaQtd>0?"#16a34a":"white",color:saunaQtd>0?"white":"#374151",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                      Sim
                    </button>
                  </div>
                  {saunaQtd>0 && (
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:13,color:"#374151",whiteSpace:"nowrap"}}>Pessoas na sauna:</span>
                      <button onClick={()=>salvarSaunaQtd(a.id, Math.max(1,saunaQtd-1))}
                        style={{width:32,height:32,borderRadius:8,border:"1.5px solid #16a34a",background:"white",color:"#16a34a",fontWeight:800,fontSize:18,cursor:"pointer"}}>−</button>
                      <span style={{fontWeight:900,fontSize:22,color:VE,minWidth:28,textAlign:"center"}}>{saunaQtd}</span>
                      <button onClick={()=>salvarSaunaQtd(a.id, saunaQtd+1)}
                        style={{width:32,height:32,borderRadius:8,border:"1.5px solid #16a34a",background:"#16a34a",color:"white",fontWeight:800,fontSize:18,cursor:"pointer"}}>+</button>
                      <span style={{fontSize:13,fontWeight:700,color:"#065f46"}}>= R$ {saunaVal.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* ── PERGUNTA 3: Ficaram mais tempo? ── */}
                <div style={{background:"#f9fafb",border:"1px solid #e0e3e8",borderRadius:10,padding:"12px",marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>⏱️ Adicionar ou remover tempo</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                    {[["-1h",-60],["-30min",-30],["+30min",30],["+1h",60]].map(([label,mins])=>(
                      <button key={label} onClick={()=>adicionarTempo(a.id, mins)}
                        style={{padding:"8px 4px",borderRadius:8,border:`1.5px solid ${mins>0?"#1e40af":"#dc2626"}`,background:"white",color:mins>0?"#1e40af":"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── PERGUNTA 4: Quanto cobrar? ── */}
                {cobrar>0 ? (
                  <div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:12,overflow:"hidden",marginTop:4}}>
                    <div style={{padding:"10px 14px",textAlign:"center",borderBottom:"1px solid #fed7aa"}}>
                      <div style={{fontSize:11,color:"#92400e",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Falta receber no balcão</div>
                      <div style={{fontWeight:900,fontSize:30,color:"#ea580c"}}>R$ {cobrar.toFixed(2)}</div>
                    </div>
                    <button onClick={()=>setModalPag(a.id)}
                      style={{width:"100%",padding:"14px",background:"#16a34a",color:"white",border:"none",fontSize:18,fontWeight:800,cursor:"pointer"}}>
                      ✅ Receber R$ {cobrar.toFixed(2)}
                    </button>
                  </div>
                ) : isPagoOnline(agE.pag) ? (
                  <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                    <span style={{fontSize:16}}>🔒</span>
                    <span style={{fontWeight:700,color:"#1e40af",fontSize:13}}>Pago online — não pode ser desfeito</span>
                  </div>
                ) : isPagoPresencial(agE.pag) ? (
                  <div style={{background:"#dcfce7",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:20}}>✅</span>
                      <span style={{fontWeight:800,color:"#065f46",fontSize:15}}>QUITADO</span>
                    </div>
                    <button onClick={()=>desfazerPag(a.id)}
                      style={{background:"none",border:"1.5px solid #16a34a",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#16a34a",cursor:"pointer"}}>
                      ↩️ Desfazer
                    </button>
                  </div>
                ) : (
                  <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",marginTop:4}}>
                    <span style={{fontWeight:700,color:"#16a34a",fontSize:13}}>✅ Pago pelo site — aguardando chegada</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PAGAMENTO */}
      {modalPag && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:420,padding:"28px 20px 24px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:16,color:"#1a1f2e",textAlign:"center"}}>Como o cliente pagou?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <button style={{padding:"20px 8px",background:"#eff6ff",border:"2px solid #1e40af",borderRadius:12,cursor:"pointer",textAlign:"center"}}
                onClick={()=>confirmarPag(modalPag,"mp_total_cartao")}>
                <div style={{fontSize:32}}>💳</div>
                <div style={{fontSize:15,fontWeight:800,color:"#1e40af",marginTop:8}}>Máquina</div>
              </button>
              <button style={{padding:"20px 8px",background:"#f0fdf4",border:"2px solid #16a34a",borderRadius:12,cursor:"pointer",textAlign:"center"}}
                onClick={()=>confirmarPag(modalPag,"mp_total_dinheiro")}>
                <div style={{fontSize:32}}>💵</div>
                <div style={{fontSize:15,fontWeight:800,color:"#16a34a",marginTop:8}}>Dinheiro</div>
              </button>
            </div>
            <button onClick={()=>{
                const agE=getAg(modalPag); const pp=getPP(agE);
                const falta=faltaReceber(agE,pp);
                setMistoMaq(falta.toFixed(2)); setMistoDin("0");
                setModalMisto(true);
              }}
              style={{width:"100%",padding:"12px",background:"#f9fafb",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",color:"#374151",marginBottom:12}}>
              💳💵 Pagamento dividido (parte cartão, parte dinheiro)
            </button>
            <button onClick={()=>setModalPag(null)}
              style={{width:"100%",padding:"13px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO MISTO */}
      {modalMisto && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:310,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:420,padding:"24px 20px"}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:4,color:"#1a1f2e",textAlign:"center"}}>💳💵 Pagamento Dividido</div>
            <div style={{textAlign:"center",marginBottom:16,background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:12,padding:"12px"}}>
              <div style={{fontSize:11,color:"#92400e",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Total a receber</div>
              <div style={{fontSize:28,fontWeight:900,color:"#ea580c"}}>R$ {(()=>{const agE=getAg(modalPag);const pp=getPP(agE);return faltaReceber(agE,pp).toFixed(2);})()}</div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:12,fontWeight:700,color:"#1e40af",marginBottom:6}}>💳 Valor na Máquina (R$)</label>
              <input type="number" inputMode="decimal" value={mistoMaq} onChange={e=>setMistoMaq(e.target.value)}
                style={{width:"100%",padding:"12px",border:"2px solid #bfdbfe",borderRadius:10,fontSize:18,fontWeight:700,color:"#1e40af",textAlign:"center"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:700,color:"#16a34a",marginBottom:6}}>💵 Valor em Dinheiro (R$)</label>
              <input type="number" inputMode="decimal" value={mistoDin} onChange={e=>setMistoDin(e.target.value)}
                style={{width:"100%",padding:"12px",border:"2px solid #bbf7d0",borderRadius:10,fontSize:18,fontWeight:700,color:"#16a34a",textAlign:"center"}}/>
            </div>
            {(()=>{
              const agE=getAg(modalPag); const pp=getPP(agE);
              const total = faltaReceber(agE,pp);
              const soma = (parseFloat(mistoMaq)||0)+(parseFloat(mistoDin)||0);
              const dif = Math.abs(soma-total);
              if(dif>0.01) return <div style={{fontSize:12,color:"#dc2626",textAlign:"center",marginBottom:12,fontWeight:700}}>⚠️ Soma (R$ {soma.toFixed(2)}) diferente do total (R$ {total.toFixed(2)})</div>;
              return <div style={{fontSize:12,color:"#16a34a",textAlign:"center",marginBottom:12,fontWeight:700}}>✅ Valores conferem</div>;
            })()}
            <button onClick={()=>{
                const valMaq=parseFloat(mistoMaq)||0;
                const valDin=parseFloat(mistoDin)||0;
                confirmarPagMisto(modalPag, valMaq, valDin);
                setModalMisto(false);
              }}
              style={{width:"100%",padding:"14px",background:"#16a34a",color:"white",border:"none",borderRadius:10,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:10}}>
              ✅ Confirmar
            </button>
            <button onClick={()=>setModalMisto(false)}
              style={{width:"100%",padding:"12px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL FECHAMENTO DO DIA */}
      {modalFechamento && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:420,padding:"24px 20px",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontWeight:800,fontSize:20,marginBottom:4,color:"#1a1f2e",textAlign:"center"}}>📋 Fechamento do Dia</div>
            <div style={{fontSize:13,color:"#6b7280",textAlign:"center",marginBottom:16,textTransform:"capitalize"}}>{nomeDia(dia)}</div>

            <div style={{background:"#f9fafb",borderRadius:12,overflow:"hidden",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #e5e7eb"}}>
                <span style={{fontSize:14,color:"#374151"}}>💳 Recebido em Máquina</span>
                <span style={{fontWeight:800,fontSize:15,color:"#1e40af"}}>R$ {recebidoMaquina.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #e5e7eb"}}>
                <span style={{fontSize:14,color:"#374151"}}>💵 Recebido em Dinheiro</span>
                <span style={{fontWeight:800,fontSize:15,color:"#16a34a"}}>R$ {recebidoDinheiro.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #e5e7eb",background:"#f3f4f6"}}>
                <span style={{fontSize:14,fontWeight:700,color:"#374151"}}>Total no balcão</span>
                <span style={{fontWeight:900,fontSize:16,color:"#1a1f2e"}}>R$ {(recebidoMaquina+recebidoDinheiro).toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:totalFalta>0?"#fff7ed":"#f0fdf4"}}>
                <span style={{fontSize:14,fontWeight:700,color:totalFalta>0?"#ea580c":"#16a34a"}}>{totalFalta>0?"⚠️ Ainda falta receber":"✅ Tudo recebido"}</span>
                <span style={{fontWeight:900,fontSize:16,color:totalFalta>0?"#ea580c":"#16a34a"}}>R$ {totalFalta.toFixed(2)}</span>
              </div>
            </div>

            <div style={{fontSize:13,color:"#6b7280",marginBottom:16,textAlign:"center"}}>
              {agsDia.length} reserva{agsDia.length!==1?"s":""} confirmada{agsDia.length!==1?"s":""} hoje
            </div>

            <div style={{fontSize:13,color:"#374151",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"10px 14px",marginBottom:16,textAlign:"center"}}>
              Confira se o valor de Máquina + Dinheiro acima bate com o seu caixa físico antes de confirmar.
            </div>

            <button onClick={()=>{setModalFechamento(false); alert("✅ Fechamento confirmado! Bom descanso 😊");}}
              style={{width:"100%",padding:"14px",background:"#16a34a",color:"white",border:"none",borderRadius:10,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:10}}>
              ✅ Confirmar fechamento
            </button>
            <button onClick={()=>setModalFechamento(false)}
              style={{width:"100%",padding:"12px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* TOAST DE CONFIRMAÇÃO */}
      {toast && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#16a34a",color:"white",padding:"14px 24px",borderRadius:14,fontWeight:800,fontSize:15,zIndex:500,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}

    </div>
  );
}
