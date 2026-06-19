import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI",
  authDomain: "agendamento-quadras-ad13b.firebaseapp.com",
  projectId: "agendamento-quadras-ad13b",
  storageBucket: "agendamento-quadras-ad13b.firebasestorage.app",
  messagingSenderId: "228136379926",
  appId: "1:228136379926:web:7741e85184909b1ecff737"
};
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp);

async function addLog(msg) {
  try { await addDoc(collection(db,"logs"),{msg, em:new Date(), origem:"admin"}); } catch(e){}
}

const V="#2E7D6B",VE="#1a5248",LA="#E8861A",VM="#e53e3e",BG="#f4f5f7";

const QP=[
  {id:"q1",nome:"Quadra Society",tipo:"Futebol Society",preco:130,cor:V,cob:"fixo",fx:null},
  {id:"q2",nome:"Quadra Areia",tipo:"Areia",preco:60,cor:LA,cob:"pessoas",
    fx:[{a:8,v:60},{a:12,v:70}],
    fxExtra:{base:12,valorBase:70,acrescimo:10}
  }
];
const CFG0={
  nome:"Complexo Esportivo Melodia",pix:"(22) 99900-8085",wpp:"(22) 99900-8085",
  // Preços centrais (sincronizados com Firebase)
  precoSocietyDia:120, precoSocietyNoite:130, horaNoite:"16:00",
  precoAreia:60, limiteAreia:12, precoExcedente:10, precoSauna:15,
  descricao:"Um campo em grama sintética e uma quadra de areia disponíveis para aluguel todos os dias da semana.\nFuncionamento da Sauna: Segunda a Sexta de 17h às 22h · Sábado 9h às 16h.\nReserva de Churrasqueira: (22) 99900-8085.\nNÃO é permitida a entrada de crianças nas quadras.",
  horarios:"Segunda a Sexta: 16h às 23h (Sauna: 18h às 22h)\nSábado e Domingo: 9h às 18h (Sauna: 10h às 17h)",
  regras:"🏖️ REGRAS EXCLUSIVAS DA QUADRA DE AREIA\n\n1. Área Reservada Exclusiva\nA locação da Quadra de Areia inclui o uso exclusivo da quadra, do deck e da churrasqueira da área reservada. Durante o período contratado, esses espaços ficam destinados exclusivamente aos participantes da locação. Para utilização da churrasqueira exclusiva, o período mínimo de locação é de 5 horas.\n\n2. Participantes da Locação\nSão considerados participantes todas as pessoas que utilizarem a área reservada da Quadra de Areia (quadra, deck e churrasqueira), independentemente de estarem jogando.\n\n⚠️ REGRAS GERAIS DO COMPLEXO\n\n3. Consumo no Local\nNão é permitida a entrada de bebidas. O consumo deverá ser realizado através do bar do complexo.\n\n4. Crianças\nPor questões de segurança, não é permitida a permanência de crianças nas quadras durante os jogos.\n\n5. Eventos e Comemorações\nA locação das quadras destina-se à prática esportiva e confraternização entre os participantes da reserva. Aniversários, confraternizações, eventos corporativos, comemorações e reuniões com convidados externos possuem condições e valores específicos e devem ser contratados separadamente.\n\n6. Confirmação\nAo concluir a reserva, você declara estar ciente e de acordo com as regras acima.",
  precos:"Quadra Society: R$130/hora\nQuadra Areia até 8 pessoas: R$60/hora\nQuadra Areia 9-12 pessoas: R$70/hora\nQuadra Areia a partir de 13 pessoas: R$70 + R$10 por pessoa acima de 12\nEx: 13 pessoas = R$80/h · 14 pessoas = R$90/h · 15 pessoas = R$100/h"
};

function fd(s){if(!s)return"";const[a,m,d]=s.split("-");return`${d}/${m}/${a}`;}
function hoje(){const d=new Date();d.setHours(0,0,0,0);return d;}
function toDS(d){return d.toISOString().split("T")[0];}
function agora(){return new Date().toISOString();}

// Quanto foi pago online (usa valPagoOnline/valOriginal fixos se disponíveis)
function pagoPeloSite(ag){
  if(!ag) return 0;
  const pag=ag.pag||"";
  if(isParcial(pag)){
    if(ag.valPagoOnline!==undefined) return parseFloat(ag.valPagoOnline)||0;
    return (parseFloat(ag.valOriginal??ag.val)||0)*0.5;
  }
  if(["mp_pix","mp_cartao","mp_total"].includes(pag)){
    return parseFloat(ag.valPagoOnline??ag.valOriginal??ag.val)||0;
  }
  return 0;
}

// Quanto falta receber (considera pagoMaquina/pagoDinheiro)
function saldoRestante(ag){
  if(!ag) return 0;
  const val=parseFloat(ag.val)||0;
  const pago=pagoPeloSite(ag)+(parseFloat(ag.pagoMaquina)||0)+(parseFloat(ag.pagoDinheiro)||0);
  const falta=val-pago;
  return falta<0.01?0:falta;
}

// Label de pagamento detalhado
function labelPag(ag){
  const pag=ag.pag||"";
  const falta=saldoRestante(ag);
  const maq=parseFloat(ag.pagoMaquina)||0;
  const din=parseFloat(ag.pagoDinheiro)||0;
  if(pag==="pendente") return "⏳ Pendente";
  if(isParcial(pag)&&falta>0) return `💛 50% pago — falta R$${falta.toFixed(2)}`;
  if(falta<=0){
    if(maq>0&&din>0) return "✅ Quitado — Misto";
    if(maq>0) return "✅ Quitado — Máquina";
    if(din>0) return "✅ Quitado — Dinheiro";
    if(["mp_pix","mp_total_pix"].includes(pag)) return "✅ Quitado — Pix";
    if(["mp_cartao","mp_total_cartao"].includes(pag)) return "✅ Quitado — Cartão";
    return "✅ Quitado";
  }
  return `💰 Falta R$${falta.toFixed(2)}`;
}

// Origem da reserva
function origemTag(ag){
  if(ag.tp==="balcao") return {label:"🏟️ Balcão", cor:"#92400e", bg:"#fef3c7"};
  if(ag.tp==="admin"||ag.tp==="manual"||ag.origem==="admin") return {label:"⚙️ Admin", cor:"#1e40af", bg:"#eff6ff"};
  return {label:"🌐 Online", cor:"#065f46", bg:"#f0fdf4"};
}

function isPago(pag){ return ["mp_total","mp_pix","mp_cartao","mp_total_pix","mp_total_cartao","mp_total_dinheiro","mp_total_misto"].includes(pag); }
function isParcial(pag){ return pag==="mp_50"; }

// Quanto foi pago online (usa valPagoOnline fixo se disponível)
function calcPagoOnline(ag) {
  const pag = ag.pag||"";
  if(isParcial(pag)) {
    if(ag.valPagoOnline !== undefined) return parseFloat(ag.valPagoOnline)||0;
    const valRef = parseFloat(ag.valOriginal ?? ag.val)||0;
    return valRef * 0.5;
  }
  if(["mp_pix","mp_cartao","mp_total"].includes(pag)) {
    return parseFloat(ag.valPagoOnline ?? ag.valOriginal ?? ag.val)||0;
  }
  return 0;
}

// Total já recebido (online + balcão)
function calcTotalRecebido(ag) {
  const maquina = parseFloat(ag.pagoMaquina)||0;
  const dinheiro = parseFloat(ag.pagoDinheiro)||0;
  if(ag.pagoMaquina !== undefined || ag.pagoDinheiro !== undefined) {
    return calcPagoOnline(ag) + maquina + dinheiro;
  }
  // Fallback reservas antigas
  const pag = ag.pag||"";
  if(isPago(pag)) return parseFloat(ag.val)||0;
  if(isParcial(pag)) {
    if(ag.valPagoOnline !== undefined) return parseFloat(ag.valPagoOnline)||0;
    return (parseFloat(ag.valOriginal ?? ag.val)||0) * 0.5;
  }
  return 0;
}

// Total valor real da reserva (quadra + extras pagos)
function calcValorTotal(ag) {
  return parseFloat(ag.val)||0;
}

const inp={width:"100%",padding:"10px 12px",border:"1.5px solid #e0e3e8",borderRadius:8,fontSize:15,background:"white",color:"#1a1f2e",outline:"none"};
const lbl={display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px"};

function Btn({c="o",full,sm,onClick,children,disabled}){
  const bg=c==="v"?V:c==="l"?LA:c==="r"?VM:c==="cinza"?"#6b7280":c==="azul"?"#1d4ed8":"white";
  const cl=(c==="o")?"#1a1f2e":"white";
  const bd=c==="o"?"1.5px solid #e0e3e8":"none";
  return <button disabled={disabled} onClick={onClick} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:sm?"6px 12px":full?"13px 18px":"9px 14px",borderRadius:8,fontSize:sm?12:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",border:bd,background:disabled?"#e0e3e8":bg,color:disabled?"#9ca3af":cl,width:full?"100%":undefined,opacity:disabled?0.7:1}}>{children}</button>;
}

function Card({children,style}){return <div style={{background:"white",borderRadius:12,boxShadow:"0 2px 12px rgba(0,0,0,.08)",overflow:"hidden",marginBottom:12,...style}}>{children}</div>;}
function CardH({title,right}){return <div style={{padding:"14px 16px",borderBottom:"1px solid #e0e3e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontWeight:700,fontSize:16}}>{title}</div>{right}</div>;}

function Badge({t,children}){
  const map={
    confirmado:["#d1fae5","#065f46"],
    aguardando_pagamento:["#e0f2fe","#0369a1"],
    pendente:["#fef3c7","#92400e"],
    cancelado:["#fee2e2","#991b1b"],
    pago:["#dbeafe","#1e40af"],
    receber:["#fef3c7","#92400e"],
    bloqueado:["#f3f4f6","#374151"],
    parcial:["#fef9c3","#854d0e"],
    quitado:["#dcfce7","#166534"],
  };
  const[bg,cl]=map[t]||map.confirmado;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:bg,color:cl}}>{children}</span>;
}

function BadgePag({ag}){
  const pag=ag?.pag||"";
  const label=labelPag(ag);
  const falta=saldoRestante(ag);
  if(isPago(pag)&&falta<=0) return <Badge t="quitado">{label}</Badge>;
  if(isParcial(pag)||falta>0) return <Badge t="parcial">{label}</Badge>;
  return <Badge t="receber">{label}</Badge>;
}

function Modal({open,onClose,children}){
  if(!open)return null;
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div style={{background:"white",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",padding:"20px 16px 40px"}}>
      <div style={{width:40,height:4,background:"#e0e3e8",borderRadius:2,margin:"0 auto 16px"}}/>
      {children}
    </div>
  </div>;
}

function Toast({msg}){
  if(!msg)return null;
  return <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:VE,color:"white",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:600,zIndex:999,whiteSpace:"nowrap",pointerEvents:"none"}}>{msg}</div>;
}

function Switch({on,onChange,label}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0"}}>
    <span style={{fontSize:14,fontWeight:500}}>{label}</span>
    <div onClick={()=>onChange(!on)} style={{width:44,height:24,borderRadius:12,background:on?V:"#e0e3e8",cursor:"pointer",position:"relative",transition:"background .2s"}}>
      <div style={{position:"absolute",width:18,height:18,borderRadius:"50%",background:"white",top:3,left:on?23:3,transition:"left .2s"}}/>
    </div>
  </div>;
}

const SENHA_ADMIN = "renata proprietaria";

function Login({onLogin}){
  const [senha,setSenha]=useState("");
  const [erro,setErro]=useState(false);
  function tentar(){
    if(senha===SENHA_ADMIN){ onLogin(); }
    else{ setErro(true); setSenha(""); }
  }
  return(
    <div style={{minHeight:"100vh",background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:16}}>
      <div style={{background:"white",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.10)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <div style={{fontWeight:900,fontSize:22,color:"#1a1f2e"}}>Painel Administrativo</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>Complexo Melodia</div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>Senha</div>
          <input
            type="password"
            value={senha}
            onChange={e=>{setSenha(e.target.value);setErro(false);}}
            onKeyDown={e=>e.key==="Enter"&&tentar()}
            placeholder="Digite a senha"
            style={{width:"100%",padding:"12px 14px",border:`2px solid ${erro?"#ef4444":"#e0e3e8"}`,borderRadius:10,fontSize:15,outline:"none",boxSizing:"border-box"}}
            autoFocus
          />
          {erro&&<div style={{color:"#ef4444",fontSize:12,marginTop:6}}>Senha incorreta. Tente novamente.</div>}
        </div>
        <button onClick={tentar}
          style={{width:"100%",padding:"13px",background:"#1a5248",color:"white",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>
          Entrar
        </button>
      </div>
    </div>
  );
}

export default function App(){
  const [logado,setLogado]=useState(()=>sessionStorage.getItem("adm_auth")==="1");
  const [pg,setPg]=useState("hoje");

  const [ags,setAgs]=useState([]);
  const [bloqueios,setBloqueios]=useState([]);
  const [blackouts,setBlackouts]=useState([]);
  const [galeria,setGaleria]=useState([]);
  const [novaFotoUrl,setNovaFotoUrl]=useState("");
  const [novaFotoLegenda,setNovaFotoLegenda]=useState("");
  const [blackoutData,setBlackoutData]=useState("");
  const [blackoutQid,setBlackoutQid]=useState("todas");
  const [blackoutMotivo,setBlackoutMotivo]=useState("");
  const [qds,setQds]=useState(QP);
  const [cfg,setCfg]=useState(CFG0);
  const [dtA,setDtA]=useState(hoje());
  const [filtro,setFiltro]=useState("todos");
  const [toast,setToast]=useState("");
  const [modalA,setModalA]=useState(false);
  const [modalD,setModalD]=useState(null);
  const [modalQ,setModalQ]=useState(false);
  const [modalB,setModalB]=useState(null);
  const [editQ,setEditQ]=useState(null);
  const [editAg,setEditAg]=useState(null);
  const [finMes,setFinMes]=useState(new Date().toISOString().slice(0,7));
  const [finTipo,setFinTipo]=useState("mes"); // mes | semana | quinzena | custom
  const [finDe,setFinDe]=useState(toDS(hoje()));
  const [finAte,setFinAte]=useState(toDS(hoje()));
  const [busca,setBusca]=useState("");
  const [churrasqueiras,setChurrasqueiras]=useState([]);
  const [modalChur,setModalChur]=useState(false);
  const [modalReag,setModalReag]=useState(null); // reserva a reagendar
  const [reagData,setReagData]=useState("");
  const [reagIni,setReagIni]=useState("");
  const [reagFim,setReagFim]=useState("");
  const [churNome,setCHurNome]=useState("");
  const [churLocal,setCHurLocal]=useState("ch1");
  const [churData,setCHurData]=useState(toDS(hoje()));
  const [logs,setLogs]=useState([]);
  const [logsLidos,setLogsLidos]=useState(()=>parseInt(localStorage.getItem("adm_logs_lidos")||"0"));
  const [showNotif,setShowNotif]=useState(false);

  useEffect(()=>{
    try {
      const unsub = onSnapshot(collection(db,"agendamentos"), snap=>{
        setAgs(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase offline",e); }
  },[]);

  useEffect(()=>{
    try {
      const unsub = onSnapshot(collection(db,"blackouts"), snap=>{
        setBlackouts(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase blackouts offline",e); }
  },[]);

  useEffect(()=>{
    try {
      const unsub = onSnapshot(collection(db,"galeria"), snap=>{
        setGaleria(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ordem||0)-(b.ordem||0)));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase galeria offline",e); }
  },[]);

  useEffect(()=>{
    try {
      const unsub = onSnapshot(collection(db,"churrasqueiras"), snap=>{
        setChurrasqueiras(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){}
  },[]);

  useEffect(()=>{
    try {
      const unsubPrecos = onSnapshot(doc(db,"config","precos"), snap=>{
        if(snap.exists()) setCfg(c=>({...c,...snap.data()}));
      });
      return ()=>unsubPrecos();
    } catch(e){}
  },[]);

  useEffect(()=>{
    try {
      const q = query(collection(db,"logs"), orderBy("em","desc"));
      const unsub = onSnapshot(q, snap=>{
        setLogs(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase logs offline",e); }
  },[]);

  const [fTipo,setFTipo]=useState("avulso");
  const [fQid,setFQid]=useState(qds[0]?.id||"");
  const [fData,setFData]=useState(toDS(hoje()));
  const [fIni,setFIni]=useState("");
  const [fFim,setFFim]=useState("");
  const [fCli,setFCli]=useState("");
  const [fTel,setFTel]=useState("");
  const [fCpf,setFCpf]=useState("");
  const [fVal,setFVal]=useState("");
  const [fPess,setFPess]=useState("");
  const [fSt,setFSt]=useState("confirmado");
  const [fPag,setFPag]=useState("pendente");
  const [fObs,setFObs]=useState("");
  const [fChurr,setFChurr]=useState(false);
  const [hintP,setHintP]=useState("");
  const [fRepetir,setFRepetir]=useState(false);
  const [fRepAte,setFRepAte]=useState("");
  const [fRepDia,setFRepDia]=useState("semanal"); // semanal | quinzenal | mensal

  const [subHoje,setSubHoje]=useState("agenda");
  const [soAgendados,setSoAgendados]=useState(false);
  const [qFiltAgenda,setQFiltAgenda]=useState("todas"); // todas | q1 | q2
  const [dsFech,setDsFech]=useState(toDS(new Date())); // data separada para o Fechamento // agenda | painel | fechamento
  const [subAgend,setSubAgend]=useState("lista"); // lista | contatos
  const [subCfg,setSubCfg]=useState("cfg"); // cfg | complexo | galeria
  const [bQid,setBQid]=useState(qds[0]?.id||"");
  const [bTipo,setBTipo]=useState("periodo"); // periodo | diasemana
  const [bDataFim,setBDataFim]=useState("");
  const [bDiasSemana,setBDiasSemana]=useState([]);
  const [bData,setBData]=useState(toDS(hoje()));
  const [bIni,setBIni]=useState("");
  const [bFim,setBFim]=useState("");
  const [bMotivo,setBMotivo]=useState("");

  const [qNm,setQNm]=useState("");const [qTp,setQTp]=useState("Futebol Society");
  const [qPr,setQPr]=useState("");const [qCr,setQCr]=useState(V);const [qCob,setQCob]=useState("fixo");
  const [qF1a,setQF1a]=useState(8);const [qF1v,setQF1v]=useState(60);
  const [qF2a,setQF2a]=useState(12);const [qF2v,setQF2v]=useState(70);const [qF3v,setQF3v]=useState(10);

  function showToast(m){setToast(m);setTimeout(()=>setToast(""),2800);}

  async function salvarBlackout(){
    if(!blackoutData){showToast("⚠️ Selecione uma data!");return;}
    const b={data:blackoutData,qid:blackoutQid,motivo:blackoutMotivo,em:agora()};
    try {
      await addDoc(collection(db,"blackouts"),b);
      addLog("🚫 Dia bloqueado: "+fd(blackoutData)+(blackoutQid!=="todas"?" — "+(qds.find(x=>x.id===blackoutQid)?.nome||""):" — Todas as quadras")+(blackoutMotivo?" ("+blackoutMotivo+")":""));
      setBlackoutData("");setBlackoutMotivo("");
      showToast("🚫 Dia bloqueado!");
    } catch(e){ showToast("❌ Erro ao bloquear!"); }
  }

  async function removerBlackout(id){
    const b=blackouts.find(x=>x.id===id);
    try {
      await deleteDoc(doc(db,"blackouts",id));
      addLog("✅ Bloqueio removido: "+fd(b?.data));
      showToast("✅ Bloqueio removido!");
    } catch(e){ showToast("❌ Erro ao remover!"); }
  }

  function isDiaBloqueado(ds, qid){
    // Só bloqueia o DIA no calendário se não tiver horário específico (bloqueio dia todo)
    return blackouts.some(b=>b.data===ds&&(b.qid==="todas"||b.qid===qid)&&(!b.ini||!b.fim));
  }

  

  function calcValorAdmin(ini,fim,qid,pess){
    if(!ini||!fim)return;
    const[ih,im]=ini.split(":").map(Number);
    const[fh,fm]=fim.split(":").map(Number);
    const durMin=(fh*60+fm)-(ih*60+im);
    if(durMin<=0)return;
    const horas=durMin/60;
    if(qid==="q2"){
      // Areia: usa preços centrais
      const precoAreia=cfg.precoAreia||60;
      const limiteAreia=cfg.limiteAreia||12;
      const precoExcedente=cfg.precoExcedente||10;
      const num=parseInt(pess||fPess)||0;
      const base=horas*precoAreia;
      const horasCompletas=Math.floor(horas);
      const extra=num>limiteAreia?(num-limiteAreia)*precoExcedente*horasCompletas:0;
      setFVal((base+extra).toFixed(2));
      return;
    }
    // Society: usa preços centrais
    const horaNoite=cfg.horaNoite||"16:00";
    const precoPorHora=ini>=horaNoite?(cfg.precoSocietyNoite||130):(cfg.precoSocietyDia||120);
    setFVal(((precoPorHora/60)*durMin).toFixed(2));
  }

  function abrirNovoAg(qid,ini,fim,ds){
    setEditAg(null);
    setFTipo("avulso");setFQid(qid||qds[0]?.id||"");
    setFData(ds||toDS(dtA));setFIni(ini||"");setFFim(fim||"");
    setFCli("");setFTel("");setFCpf("");setFVal("");setFPess("");setHintP("");
    setFSt("confirmado");setFPag("pendente");setFObs("");setFChurr(false);setFRepetir(false);setFRepAte("");setFRepDia("semanal");
    if(qid&&ini&&fim)calcValorAdmin(ini,fim,qid);
    else if(qid){const q=qds.find(x=>x.id===qid);if(q&&q.cob!=="pessoas")setFVal(String(q.preco||""));}
    setModalA(true);
  }

  function abrirEditAg(a){
    setEditAg(a);
    setFTipo(a.tp||"avulso");setFQid(a.qid||"");setFData(a.data||"");
    setFIni(a.ini||"");setFFim(a.fim||"");setFCli(a.cli||"");setFTel(a.tel||"");
    setFCpf(a.cpf||"");setFVal(String(a.val||""));setFPess(String(a.pess||""));setHintP("");
    setFSt(a.st||"confirmado");setFPag(a.pag||"pendente");setFObs(a.obs||"");setFChurr(!!a.churr);
    setModalA(true);
  }

  async function salvarAg(){
    if(!fData||!fIni||!fFim){showToast("⚠️ Preencha data e horário!");return;}
    const q=qds.find(x=>x.id===fQid);
    const base={tp:fTipo,origem:"admin",qid:fQid,qnm:q?.nome||"",ini:fIni,fim:fFim,cli:fCli,tel:fTel,cpf:fCpf,val:parseFloat(fVal)||0,pess:parseInt(fPess)||null,st:fSt,pag:fPag,obs:fObs,churr:fChurr,criadoEm:serverTimestamp()};
    try {
      if(editAg){
        const historico = editAg.historico || [];
        const entrada = {
          msg: `✏️ Editado por Admin`,
          de: `${editAg.ini}–${editAg.fim} · R$${editAg.val||0}`,
          para: `${fIni}–${fFim} · R$${fVal}`,
          em: agora()
        };
        await updateDoc(doc(db,"agendamentos",editAg.id),{...base,data:fData,historico:[entrada,...historico].slice(0,20)});
        addLog(`✏️ Agendamento editado: ${fCli||"Avulso"} — ${q?.nome} ${fd(fData)} ${fIni}`);
        setModalA(false);showToast("✅ Agendamento salvo!");
        return;
      }
      // Criar reservas — únicas ou repetidas
      const datas=[];
      const dataInicio=new Date(fData+"T12:00:00");
      datas.push(fData);
      if(fRepetir && fRepAte && fTipo==="mensalista"){
        const dataFim=new Date(fRepAte+"T12:00:00");
        let cur=new Date(dataInicio);
        const intervalo=fRepDia==="semanal"?7:fRepDia==="quinzenal"?14:null;
        while(true){
          if(intervalo){
            cur=new Date(cur.getTime()+intervalo*24*60*60*1000);
          } else {
            // mensal — mesmo dia do mês seguinte
            cur=new Date(cur);
            cur.setMonth(cur.getMonth()+1);
          }
          if(cur>dataFim)break;
          datas.push(toDS(cur));
        }
      }
      for(const data of datas){
        await addDoc(collection(db,"agendamentos"),{
          ...base, data,
          ...(fRepetir&&fRepAte&&fTipo==="mensalista"?{repAte:fRepAte}:{})
        });
      }
      addLog(`📅 ${datas.length>1?datas.length+"x ":""}Agendamento: ${fCli||"Avulso"} — ${q?.nome} ${fd(fData)} ${fIni}${datas.length>1?" (recorrente até "+fd(fRepAte)+")":""}`);
      // WhatsApp opcional — disponível no modal de detalhe
      setModalA(false);
      showToast(datas.length>1?`✅ ${datas.length} reservas criadas!`:"✅ Agendamento salvo!");
    } catch(e){ showToast("❌ Erro ao salvar!"); }
  }

  async function deletarAg(){
    if(!confirm("Excluir este agendamento?"))return;
    const a=ags.find(x=>x.id===editAg.id);
    try {
      await deleteDoc(doc(db,"agendamentos",editAg.id));
      addLog(`🗑️ Agendamento removido: ${a?.cli||"Avulso"} — ${a?.qnm} ${fd(a?.data)} ${a?.ini}`);
      setModalA(false);showToast("🗑️ Excluído");
    } catch(e){ showToast("❌ Erro ao excluir!"); }
  }

  async function remarcarAg(){
    const novaData=prompt("Nova data (AAAA-MM-DD):",editAg?.data||"");
    if(!novaData)return;
    const novoIni=prompt("Novo horário início (HH:MM):",editAg?.ini||"");
    if(!novoIni)return;
    const novoFim=prompt("Novo horário fim (HH:MM):",editAg?.fim||"");
    if(!novoFim)return;
    const a=ags.find(x=>x.id===editAg.id);
    try {
      const histRem = a?.historico || [];
      const entradaRem = {msg:`🔄 Remarcado por Admin`,de:`${fd(a?.data)} ${a?.ini}`,para:`${fd(novaData)} ${novoIni}`,em:agora()};
      await updateDoc(doc(db,"agendamentos",editAg.id),{data:novaData,ini:novoIni,fim:novoFim,remarcado:true,dataOriginal:a?.data||"",iniOriginal:a?.ini||"",historico:[entradaRem,...histRem].slice(0,20)});
      addLog("🔄 Agendamento remarcado: "+(a?.cli||"Avulso")+" — "+a?.qnm+" de "+fd(a?.data)+" "+a?.ini+" para "+fd(novaData)+" "+novoIni);
      setModalA(false);showToast("🔄 Agendamento remarcado!");
    } catch(e){ showToast("❌ Erro ao remarcar"); }
  }

  async function cancelarAg(){
    if(!confirm("Cancelar este agendamento?"))return;
    const a=ags.find(x=>x.id===editAg.id);
    try {
      const historico = a?.historico || [];
      const entrada = {msg:"❌ Cancelado por Admin",em:agora()};
      await updateDoc(doc(db,"agendamentos",editAg.id),{st:"cancelado",historico:[entrada,...historico].slice(0,20)});
      addLog(`❌ Agendamento cancelado: ${a?.cli||"Avulso"} — ${a?.qnm} ${fd(a?.data)} ${a?.ini}`);
      setModalA(false);showToast("❌ Agendamento cancelado");
    } catch(e){ showToast("❌ Erro ao cancelar!"); }
  }

  async function salvarBloqueio(){
    if(!bData){showToast("⚠️ Preencha a data de início!");return;}
    if(bTipo==="diasemana" && bDiasSemana.length===0){showToast("⚠️ Selecione ao menos um dia da semana!");return;}
    const q=qds.find(x=>x.id===bQid);

    // Gerar lista de datas a bloquear
    const datas=[];
    const dataInicio=new Date(bData+"T12:00:00");
    const dataFim=bDataFim?new Date(bDataFim+"T12:00:00"):dataInicio;

    let cur=new Date(dataInicio);
    while(cur<=dataFim){
      const ds=toDS(cur);
      // Se dias da semana selecionados, filtrar — independente do tipo
      if(bDiasSemana.length>0){
        if(bDiasSemana.includes(cur.getDay())) datas.push(ds);
      } else {
        datas.push(ds); // sem filtro de dia = bloqueia todo o período
      }
      cur=new Date(cur.getTime()+24*60*60*1000);
    }

    if(datas.length===0){showToast("⚠️ Nenhuma data encontrada!");return;}

    // Criar bloqueios no Firebase
    try {
      for(const data of datas){
        await addDoc(collection(db,"blackouts"),{
          qid:bQid, data,
          ini:bIni||null, fim:bFim||null,
          motivo:bMotivo, em:agora()
        });
      }
      addLog(`🔒 ${datas.length} dia(s) bloqueado(s): ${q?.nome} ${fd(bData)}${bDataFim&&bDataFim!==bData?" até "+fd(bDataFim):""}${bMotivo?" ("+bMotivo+")":""}`);
      setModalB(false);
      setBMotivo("");setBIni("");setBFim("");setBDataFim("");setBDiasSemana([]);
      showToast(`🔒 ${datas.length} dia(s) bloqueado(s)!`);
    } catch(e){ showToast("❌ Erro ao bloquear!"); }
  }

  async function desbloqueio(id){
    const b=blackouts.find(x=>x.id===id);
    if(!window.confirm("Desbloquear este horário?")) return;
    try {
      await deleteDoc(doc(db,"blackouts",id));
      addLog("🔓 Horário desbloqueado: "+(b?.qnm||"")+" "+fd(b?.data)+" "+( b?.ini||"dia todo")+"–"+(b?.fim||""));
      showToast("🔓 Horário desbloqueado!");
    } catch(e){ showToast("❌ Erro ao desbloquear!"); }
  }

  function salvarQ(){
    const id=editQ?.id||("q_"+Date.now());
    const q={id,nome:qNm,tipo:qTp,preco:parseFloat(qPr)||0,cor:qCr,cob:qCob,fx:qCob==="pessoas"?[{a:qF1a,v:qF1v},{a:qF2a,v:qF2v},{a:999,vp:qF3v}]:null};
    setQds(prev=>{const i=prev.findIndex(x=>x.id===id);return i>=0?prev.map(x=>x.id===id?q:x):[...prev,q];});
    setModalQ(false);showToast("✅ Quadra salva!");
  }

  function abrirEditQ(q){
    setEditQ(q);setQNm(q.nome);setQTp(q.tipo);setQPr(String(q.preco));setQCr(q.cor);setQCob(q.cob||"fixo");
    if(q.fx){setQF1a(q.fx[0]?.a||8);setQF1v(q.fx[0]?.v||60);setQF2a(q.fx[1]?.a||12);setQF2v(q.fx[1]?.v||70);setQF3v(q.fx[2]?.vp||10);}
    setModalQ(true);
  }

  const hjDS=toDS(hoje());
  const mes=hoje().getMonth(),ano=hoje().getFullYear();
  const sHoje=ags.filter(a=>a.data===hjDS&&a.st!=="cancelado").length;
  const sMes=ags.filter(a=>{const d=new Date(a.data);return d.getMonth()===mes&&d.getFullYear()===ano&&a.st!=="cancelado";}).length;
  const sRec=ags.filter(a=>!isPago(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+saldoRestante(a),0);
  const sRecm=ags.filter(a=>{const d=new Date(a.data);return d.getMonth()===mes&&d.getFullYear()===ano&&isPago(a.pag);}).reduce((s,a)=>s+(a.val||0),0);

  const ds=toDS(dtA);
  const ddDia=ags.filter(a=>a.data===ds&&a.st!=="cancelado"&&a.st!=="aguardando_pagamento");
  const blDia=blackouts.filter(b=>b.data===ds);

  let agFilt=[...ags].sort((a,b)=>b.data.localeCompare(a.data));
  if(filtro==="avulso"||filtro==="mensalista")agFilt=agFilt.filter(a=>a.tp===filtro);
  else if(filtro==="conf")agFilt=agFilt.filter(a=>a.st==="confirmado");
  else if(filtro==="aguard")agFilt=agFilt.filter(a=>a.st==="aguardando_pagamento");
  else if(filtro==="canc")agFilt=agFilt.filter(a=>a.st==="cancelado");
  else if(filtro==="rec")agFilt=agFilt.filter(a=>a.pag==="pendente"&&a.st!=="cancelado");
  else if(filtro==="parcial")agFilt=agFilt.filter(a=>isParcial(a.pag)&&a.st!=="cancelado");
  else if(filtro==="pago")agFilt=agFilt.filter(a=>isPago(a.pag));

  // Calcular período selecionado
  const finPeriodo = (()=>{
    const hj = toDS(hoje());
    if(finTipo==="mes") {
      const[y,m]=finMes.split("-");
      return {de:`${y}-${m}-01`,ate:`${y}-${m}-31`};
    }
    if(finTipo==="semana") {
      const d=new Date(hoje());
      d.setDate(d.getDate()-6);
      return {de:toDS(d),ate:hj};
    }
    if(finTipo==="quinzena") {
      const d=new Date(hoje());
      d.setDate(d.getDate()-14);
      return {de:toDS(d),ate:hj};
    }
    return {de:finDe,ate:finAte};
  })();
  const finL=ags.filter(a=>{
    if(!a.data) return false;
    return a.data>=finPeriodo.de && a.data<=finPeriodo.ate;
  });
  const finRec=finL.filter(a=>isPago(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+calcValorTotal(a),0);
  const finParcial=finL.filter(a=>isParcial(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+calcPagoOnline(a),0);
  const finPend=finL.filter(a=>a.pag==="pendente"&&a.st!=="cancelado").reduce((s,a)=>s+(a.val||0),0);
  const finSite=finL.filter(a=>a.st!=="cancelado").reduce((s,a)=>s+calcPagoOnline(a),0);
  const finBalcao=finL.filter(a=>a.st!=="cancelado").reduce((s,a)=>s+(parseFloat(a.pagoMaquina)||0)+(parseFloat(a.pagoDinheiro)||0),0);
  // Breakdown por quadra
  const finSociety=finL.filter(a=>a.qid==="q1"&&a.st!=="cancelado").reduce((s,a)=>s+calcTotalRecebido(a),0);
  const finAreia=finL.filter(a=>a.qid==="q2"&&a.st!=="cancelado").reduce((s,a)=>s+calcTotalRecebido(a),0);
  const finSauna=finL.filter(a=>a.st!=="cancelado"&&(parseInt(a.saunaQtd)||0)>0).reduce((s,a)=>s+((parseInt(a.saunaQtd)||0)*15),0);
  const finPorDia={};
  finL.filter(a=>a.st!=="cancelado"&&calcTotalRecebido(a)>0).forEach(a=>{
    const d=a.data||"";
    if(!finPorDia[d])finPorDia[d]={site:0,balcao:0,society:0,areia:0,sauna:0};
    finPorDia[d].site+=calcPagoOnline(a);
    finPorDia[d].balcao+=(parseFloat(a.pagoMaquina)||0)+(parseFloat(a.pagoDinheiro)||0);
    if(a.qid==="q1") finPorDia[d].society+=calcTotalRecebido(a);
    if(a.qid==="q2") finPorDia[d].areia+=calcTotalRecebido(a);
    finPorDia[d].sauna+=((parseInt(a.saunaQtd)||0)*15);
  });
  const finDias=Object.entries(finPorDia).sort((a,b)=>b[0].localeCompare(a[0]));

  const ctMap={};
  const ctCount={};
  ags.filter(a=>a.st!=="cancelado").forEach(a=>{
    if(a.cli){
      ctMap[a.cli]={tel:a.tel||"",cpf:a.cpf||""};
      ctCount[a.cli]=(ctCount[a.cli]||0)+1;
    }
  });
  const cts=Object.entries(ctMap).map(([n,d])=>({n,...d,count:ctCount[n]||0}));
  const clientesFrequentes=cts.filter(c=>c.count>=10).sort((a,b)=>b.count-a.count);

  // Mensalistas vencendo em até 5 dias
  const hoje5 = new Date();
  const em5dias = new Date(hoje5.getTime()+5*24*60*60*1000);
  const ds5 = toDS(em5dias);
  const dsHoje = toDS(hoje5);
  const mensalistasVencendo = ags.filter(a=>
    a.tp==="mensalista" && a.repAte && a.st!=="cancelado" &&
    a.repAte>=dsHoje && a.repAte<=ds5
  ).reduce((acc,a)=>{
    // Deduplicar por cliente+quadra
    const key = `${a.cli}|${a.qid}`;
    if(!acc.find(x=>x.key===key)) acc.push({key, cli:a.cli, qnm:a.qnm, repAte:a.repAte, tel:a.tel});
    return acc;
  },[]);
  const ctsFilt=busca?cts.filter(c=>c.n.toLowerCase().includes(busca.toLowerCase())):cts;

  const TABS=[{id:"hoje",lbl:"🏠 Hoje"},{id:"agend",lbl:"📋 Reservas"},{id:"fin",lbl:"💰 Financeiro"},{id:"cfg",lbl:"⚙️ Config"}];
  const TIPOS=["avulso","mensalista","parceiro","evento"];
  const TLBL=["● Avulso","↺ Mensalista","🤝 Parceiro","🎉 Evento"];

  function SlotAgenda({q}){
    const dq=ddDia.filter(a=>a.qid===q.id);
    const bq=blDia.filter(b=>b.qid===q.id||b.qid==="todas");
    return(
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,textTransform:"uppercase",letterSpacing:1,padding:"8px 0 6px",borderBottom:`2px solid ${q.cor}`,marginBottom:8,color:q.cor,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {q.nome}
          <button onClick={()=>{setModalB(true);setBQid(q.id);setBData(ds);}} style={{background:"none",border:"1.5px solid #e0e3e8",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#6b7280",cursor:"pointer"}}>🔒 Bloquear</button>
        </div>
        {Array.from({length:30},(_,i)=>i).map(i=>{
          const totalMin=(8*60)+(i*30);
          const hh=Math.floor(totalMin/60).toString().padStart(2,"0");
          const mm=(totalMin%60).toString().padStart(2,"0");
          const hr=`${hh}:${mm}`;
          const totalMinFim=totalMin+30;
          const hhf=Math.floor(totalMinFim/60).toString().padStart(2,"0");
          const mmf=(totalMinFim%60).toString().padStart(2,"0");
          const hf=`${hhf}:${mmf}`;
          // Slots passados: some se livre, fica se ocupado
if(ds===toDS(new Date())){
  const agoraMin=new Date().getHours()*60+new Date().getMinutes();
  if(totalMinFim<=agoraMin){
    const agPass=dq.find(x=>x.ini<=hr&&x.fim>hr);
    const blPass=blackouts.filter(b=>b.qid===q.id||b.qid==="todas").find(x=>{
      if(!x.ini||!x.fim) return true;
      return x.ini<=hr&&x.fim>hr;
    });
    if(!agPass&&!blPass) return null;
  }
}
          const agoraMinSlot=new Date().getHours()*60+new Date().getMinutes();
          const passou=ds===toDS(new Date())&&totalMinFim<=agoraMinSlot;
          const ag=dq.find(x=>x.ini<=hr&&x.fim>hr);
          // Bloqueio: sem horário = dia todo, com horário = intervalo específico
          const bl=bq.find(x=>{
            if(!x.ini||!x.fim) return true; // dia todo bloqueado
            return x.ini<=hr&&x.fim>hr;     // bloqueio por horário
          });
          if(ag&&ag.ini!==hr)return null;
          if(bl&&bl.ini!==hr)return null;
          if(bl)return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,border:"1.5px solid #e5e7eb",background:"#f9fafb",cursor:"pointer"}} onClick={()=>desbloqueio(bl.id)}>
              <div style={{fontWeight:700,fontSize:14,minWidth:105,color:"#6b7280"}}>{bl.ini}–{bl.fim}</div>
              <div style={{flex:1,fontSize:13,color:"#6b7280"}}>🔒 Bloqueado{bl.motivo?" — "+bl.motivo:""}</div>
              <span style={{fontSize:11,color:"#9ca3af"}}>toque p/ desbloquear</span>
            </div>
          );
          if(ag)return(()=>{
            const orig=origemTag(ag);
            const label=labelPag(ag);
            const falta=saldoRestante(ag);
            const saunaQtd=parseInt(ag.saunaQtd)||0;
            return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,border:`1.5px solid ${passou?"#d1d5db":falta>0?"#fca5a5":"#bbf7d0"}`,background:passou?"#f3f4f6":falta>0?"#fff7ed":"#f0fdf4",opacity:passou?0.7:1}}>
              <div style={{flex:1,display:"flex",alignItems:"center",cursor:"pointer"}} onClick={()=>setModalD(ag)}>
                <div style={{fontWeight:700,fontSize:14,minWidth:105,color:"#374151"}}>{ag.ini}–{ag.fim}</div>
                <div style={{flex:1,fontSize:13,minWidth:0}}>
                  <div style={{fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ag.cli||"Reservado"}</div>
                  <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,color:orig.cor,background:orig.bg,borderRadius:4,padding:"1px 5px"}}>{orig.label}</span>
                   {ag.pess&&<span style={{fontSize:10,color:"#6b7280"}}>👥 {ag.pess}</span>}
<span onClick={async e=>{e.stopPropagation();const qtd=parseInt(prompt("Quantas pessoas vão usar a sauna? (0 para remover)",ag.saunaQtd||0));if(isNaN(qtd))return;await updateDoc(doc(db,"agendamentos",ag.id),{sauna:qtd>0,saunaQtd:qtd});showToast(qtd>0?"🧖 Sauna registrada!":"🧖 Sauna removida!");}}
  style={{fontSize:10,color:saunaQtd>0?"#16a34a":"#9ca3af",cursor:"pointer",background:saunaQtd>0?"#f0fdf4":"#f9fafb",borderRadius:4,padding:"1px 5px",border:`1px solid ${saunaQtd>0?"#bbf7d0":"#e0e3e8"}`}}>
  🧖 {saunaQtd>0?saunaQtd+"p":"sauna"}
</span>
                  </div>
                  <div style={{fontSize:10,color:falta>0?"#dc2626":"#16a34a",marginTop:2,fontWeight:600}}>{label}</div>
                </div>
                <div style={{textAlign:"right",minWidth:72}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#1a1f2e"}}>R${(ag.val||0).toFixed(0)}</div>
                  {calcPagoOnline(ag)>0&&<div style={{fontSize:10,color:"#1d4ed8",fontWeight:700}}>💻R${calcPagoOnline(ag).toFixed(0)}</div>}
                  {((parseFloat(ag.pagoMaquina)||0)+(parseFloat(ag.pagoDinheiro)||0))>0&&<div style={{fontSize:10,color:"#065f46",fontWeight:700}}>🏟️R${((parseFloat(ag.pagoMaquina)||0)+(parseFloat(ag.pagoDinheiro)||0)).toFixed(0)}</div>}
                  {falta>0&&<div style={{fontSize:10,color:"#dc2626",fontWeight:700}}>⏳R${falta.toFixed(0)}</div>}
                </div>
              </div>
              <button onClick={e=>{e.stopPropagation();setReagData(ag.data);setReagIni(ag.ini);setReagFim(ag.fim);setModalReag(ag);}}
                style={{background:"#e0f2fe",border:"none",borderRadius:6,padding:"6px 8px",fontSize:13,cursor:"pointer",marginLeft:6,flexShrink:0}}
                title="Reagendar por chuva">🌧️</button>
            </div>
            );
          })();
        if(soAgendados) return null;
          return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"8px 12px",borderRadius:8,marginBottom:6,cursor:"pointer",border:"1px solid #e8f5e9",background:"#fafffe"}} onClick={()=>abrirNovoAg(q.id,hr,hf,ds)}>
              <div style={{fontWeight:600,fontSize:13,color:"#9ca3af"}}>{hr}</div>
            </div>
          );
        })}
      </div>
    );
  }

  



if(!logado) return <Login onLogin={()=>{sessionStorage.setItem("adm_auth","1");setLogado(true);}}/>;

  function exportarCSV() {
    const periodo = finTipo==="mes" ? finMes : finTipo==="semana" ? "7dias" : finTipo==="quinzena" ? "15dias" : finDe+"_"+finAte;
    const cab = "Data;Horario;Cliente;Quadra;Pessoas;Pagamento;Valor;Pago Online;A Receber;Status";
    const rows = [...finL].sort((a,b)=>a.data.localeCompare(b.data)).map(a=>{
      return [fd(a.data),a.ini+" as "+a.fim,a.cli||"Avulso",a.qnm||"",a.pess||"",a.pag||"",(a.val||0).toFixed(2),calcPagoOnline(a).toFixed(2),saldoRestante(a).toFixed(2),a.st||""].join(";");
    });
    const csv = cab + "\r\n" + rows.join("\r\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "financeiro_"+periodo+".csv";
    el.click();
    URL.revokeObjectURL(url);
    showToast("✅ Exportado!");
  }

  // Slots de horário de funcionamento baseados na data selecionada
  const fDataObj = fData ? new Date(fData+'T12:00:00') : new Date();
  const fDow = fDataObj.getDay();
  const fFds = fDow===0||fDow===6;
  const fHA = fFds?9:16, fHB = fFds?18:23;
  const adminSlots = Array.from({length:50},(_,i)=>{ const m=i*30; const h=Math.floor(m/60).toString().padStart(2,'0'); const min=(m%60).toString().padStart(2,'0'); return h+':'+min; }).filter(s=>{ const[h,m]=s.split(':').map(Number); const min=h*60+m; return min>=fHA*60&&min<=fHB*60; });
  const bloqueioSlots = Array.from({length:50},(_,i)=>{ const m=i*30; const h=Math.floor(m/60).toString().padStart(2,'0'); const min=(m%60).toString().padStart(2,'0'); return h+':'+min; }).filter(s=>{ const[h]=s.split(':').map(Number); return h>=9&&h<=23; });

  // Componente sub-tabs inline
  function SubTabs({aba, setAba, tabs}){
    return(
      <div style={{display:"flex",gap:6,marginBottom:16,background:"white",borderRadius:10,padding:4,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        {tabs.map(([id,lbl])=>(
          <button key={id} onClick={()=>setAba(id)}
            style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",
              background:aba===id?VE:"transparent",color:aba===id?"white":"#6b7280",transition:"all .15s"}}>
            {lbl}
          </button>
        ))}
      </div>
    );
  }

  // Mesclar clientes duplicados por CPF ou telefone
  async function mesclarClientes(principal, duplicados){
    if(!window.confirm("Mesclar "+duplicados.length+" reserva(s) para "+principal.cli+"?")) return;
    try {
      for(const ag of duplicados){
        await updateDoc(doc(db,"agendamentos",ag.id),{
          cli: principal.cli,
          tel: principal.tel||ag.tel,
          cpf: principal.cpf||ag.cpf,
          email: principal.email||ag.email,
        });
      }
      addLog("🔀 Clientes mesclados → "+principal.cli+" ("+duplicados.length+" reservas)");
      showToast("✅ "+duplicados.length+" reserva(s) atualizadas!");
    } catch(e){ showToast("❌ Erro ao mesclar!"); }
  }

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>

      <div style={{background:VE,color:"white",padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,.2)"}}>
        <div style={{fontWeight:800,fontSize:18,display:"flex",alignItems:"center",gap:8}}>⚽ MELODIA <span style={{color:LA}}>QUADRAS</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{background:LA,color:"white",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,textTransform:"uppercase"}}>Admin</span>
          <button onClick={()=>{setShowNotif(v=>!v);const n=logs.length;setLogsLidos(n);localStorage.setItem("adm_logs_lidos",n);}}
            style={{position:"relative",background:"none",border:"none",cursor:"pointer",fontSize:22,padding:4,lineHeight:1}}>
            🔔
            {mensalistasVencendo.length>0&&(
              <span style={{position:"absolute",top:-4,left:-4,background:"#dc2626",color:"white",fontSize:9,fontWeight:900,borderRadius:10,padding:"1px 4px",minWidth:14,textAlign:"center"}}>
                {mensalistasVencendo.length}
              </span>
            )}
            {logs.length>logsLidos&&(
              <span style={{position:"absolute",top:0,right:0,background:"#dc2626",color:"white",fontSize:9,fontWeight:900,borderRadius:10,padding:"1px 4px",minWidth:14,textAlign:"center"}}>
                {logs.length-logsLidos}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* PAINEL DE NOTIFICAÇÕES */}
      {showNotif&&(
        <div style={{position:"fixed",top:56,right:0,width:320,maxHeight:"70vh",overflowY:"auto",background:"white",boxShadow:"0 4px 20px rgba(0,0,0,0.15)",zIndex:200,borderRadius:"0 0 0 12px"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #e0e3e8",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:800,fontSize:14}}>🔔 Histórico de Atividades</span>
            <button onClick={()=>setShowNotif(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#6b7280"}}>✕</button>
          </div>
          {logs.length===0&&<div style={{padding:20,textAlign:"center",color:"#9ca3af",fontSize:13}}>Nenhuma atividade ainda</div>}
          {logs.map(l=>(
            <div key={l.id} style={{padding:"10px 16px",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,
                  background:l.origem==="admin"?"#eff6ff":"#f0fdf4",
                  color:l.origem==="admin"?"#1e40af":"#16a34a"}}>
                  {l.origem==="admin"?"⚙️ Admin":"🧑‍💼 Shay"}
                </span>
              </div>
              <div style={{fontSize:13,color:"#1a1f2e"}}>{l.msg||l.acao}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{l.em ? new Date(l.em.seconds?l.em.seconds*1000:l.em).toLocaleString("pt-BR") : ""}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{background:"white",display:"flex",borderBottom:"2px solid #e0e3e8",overflowX:"auto",position:"sticky",top:56,zIndex:99}}>
        {TABS.map(t=><button key={t.id} onClick={()=>{setPg(t.id);setSoAgendados(false);}} style={{flex:"none",padding:"12px 14px",fontSize:13,fontWeight:600,color:pg===t.id?V:"#6b7280",cursor:"pointer",border:"none",background:"none",borderBottom:pg===t.id?`3px solid ${V}`:"3px solid transparent",marginBottom:-2,whiteSpace:"nowrap"}}>{t.lbl}</button>)}
      </div>

      {/* ── AGENDA ── */}
      {pg==="hoje"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subHoje} setAba={setSubHoje} tabs={[["agenda","📅 Agenda"],["painel","📊 Painel"],["fechamento","📆 Fechamento"]]}/>
        {subHoje==="agenda"&&<div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[["todas","Todas"],["q1","⚽ Society"],["q2","🏐 Areia"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setQFiltAgenda(id)}
              style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",
                background:qFiltAgenda===id?VE:"#f0f4f8",color:qFiltAgenda===id?"white":"#6b7280",transition:"all .15s"}}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={{width:36,height:36,borderRadius:8,border:"1.5px solid #e0e3e8",background:"white",cursor:"pointer",fontSize:18}} onClick={()=>setDtA(d=>{const n=new Date(d);n.setDate(n.getDate()-1);return n;})}>‹</button>
          <div style={{flex:1,textAlign:"center",fontWeight:700,fontSize:15,textTransform:"uppercase"}}>
            {dtA.toDateString()===hoje().toDateString()?"Hoje, "+dtA.toLocaleDateString("pt-BR",{day:"numeric",month:"short"}):dtA.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}
          </div>
          <button style={{width:36,height:36,borderRadius:8,border:"1.5px solid #e0e3e8",background:"white",cursor:"pointer",fontSize:18}} onClick={()=>setDtA(d=>{const n=new Date(d);n.setDate(n.getDate()+1);return n;})}>›</button>
          <Btn sm onClick={()=>setDtA(hoje())}>Hoje</Btn>
        </div>

        

        {/* Aviso de dia bloqueado */}
        {qds.filter(q=>qFiltAgenda==="todas"||q.id===qFiltAgenda).map(q=>{
          const bl=blackouts.find(b=>b.data===ds&&(b.qid==="todas"||b.qid===q.id)&&(!b.ini||!b.fim));
          if(!bl) return <SlotAgenda key={q.id} q={q}/>;
          return (
            <div key={q.id} style={{background:"#fee2e2",border:"1.5px solid #fca5a5",borderRadius:12,padding:16,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:700,color:"#dc2626",fontSize:15}}>🚫 {q.nome} — Dia bloqueado</div>
                {bl.motivo&&<div style={{fontSize:13,color:"#6b7280",marginTop:4}}>{bl.motivo}</div>}
              </div>
              <button onClick={()=>removerBlackout(bl.id)}
                style={{background:"none",border:"1.5px solid #dc2626",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#dc2626",cursor:"pointer"}}>
                Desbloquear
              </button>
            </div>
          );
        })}
      </div>}

      </div>}
      {/* ── PAINEL ── */}
      {pg==="hoje"&&subHoje==="painel"&&<div style={{padding:16,paddingBottom:80}}>

        {/* MENSALISTAS VENCENDO */}
        {mensalistasVencendo.length>0&&(
          <div style={{background:"#fef2f2",border:"1.5px solid #fca5a5",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:14,color:"#dc2626",marginBottom:8}}>🔴 Mensalistas vencendo em 5 dias</div>
            {mensalistasVencendo.map(m=>(
              <div key={m.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #fecaca"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#1a1f2e"}}>{m.cli}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>{m.qnm} — vence {new Date(m.repAte+"T12:00:00").toLocaleDateString("pt-BR")}</div>
                </div>
                {m.tel&&<a href={`https://wa.me/55${m.tel.replace(/\D/g,"")}`} target="_blank"
                  style={{fontSize:11,fontWeight:700,color:"white",background:"#25d366",borderRadius:8,padding:"4px 10px",textDecoration:"none"}}>
                  WhatsApp
                </a>}
              </div>
            ))}
          </div>
        )}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
{(()=>{
  const semPagHoje=ags.filter(a=>a.data===hjDS&&a.st==="confirmado"&&a.pag==="pendente").length;
  return [["Hoje",sHoje,"agenda",semPagHoje],["Este Mês",sMes,null,0],["A Receber","R$"+sRec.toFixed(0),null,0],["Recebido Mês","R$"+sRecm.toFixed(0),null,0]].map(([l,v,aba,alerta])=>(
    <div key={l} onClick={()=>{if(aba){setPg("hoje");setSubHoje("agenda");setSoAgendados(true);}}}
      style={{background:"white",borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center",cursor:aba?"pointer":"default",border:alerta>0?"1.5px solid #fca5a5":"none",position:"relative"}}>
      {alerta>0&&<span style={{position:"absolute",top:-6,right:-6,background:"#dc2626",color:"white",fontSize:10,fontWeight:900,borderRadius:10,padding:"2px 6px"}}>{alerta} sem pag</span>}
      <div style={{fontWeight:800,fontSize:28,color:VE}}>{v}</div>
      <div style={{fontSize:12,color:"#6b7280",marginTop:2,fontWeight:600}}>{l}</div>
      {aba&&<div style={{fontSize:10,color:"#16a34a",marginTop:4,fontWeight:700}}>ver agenda →</div>}
    </div>
  ));
})()}
 </div>
          ))}
       </div>
        <Card>
          <CardH title="📋 Atividade Recente"/>
          <div style={{padding:16}}>
            {(cfg.logs||[]).length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:24}}>Nenhuma atividade ainda</div>}
            {(cfg.logs||[]).map((lg,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:"1px solid #e0e3e8",fontSize:13}}>
                {lg.msg}
                <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{new Date(lg.em).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </Card>
        {/* CHURRASQUEIRAS */}
        {(()=>{
          const ds2=toDS(dtA);
          const chDia=churrasqueiras.filter(c=>c.data===ds2);
          const CHURS=[{id:"ch1",label:"🔥 Churrasqueira 1"},{id:"ch2",label:"🔥 Churrasqueira 2"},{id:"cha",label:"🔥 Churrasqueira da Areia"}];
      if(soAgendados) return null;   
      return(
            <div style={{marginTop:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:13,color:"#374151"}}>🔥 Churrasqueiras</div>
                <button onClick={()=>{setCHurData(ds2);setModalChur(true);}}
                  style={{background:"#ea580c",color:"white",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  + Reservar
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {CHURS.map(ch=>{
                  const reservas=chDia.filter(c=>c.local===ch.id);
                  return(
                    <div key={ch.id} style={{background:reservas.length>0?"#fff7ed":"#f9fafb",border:`1.5px solid ${reservas.length>0?"#fed7aa":"#e0e3e8"}`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:700,color:reservas.length>0?"#ea580c":"#6b7280",marginBottom:4}}>{ch.label}</div>
                      {reservas.length===0
                        ? <div style={{fontSize:11,color:"#9ca3af"}}>Livre</div>
                        : reservas.map(r=>(
                            <div key={r.id} style={{fontSize:11,fontWeight:600,color:"#9a3412",background:"#ffedd5",borderRadius:6,padding:"2px 4px",marginBottom:3,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span>{r.nome}</span>
                              <button onClick={async()=>{if(window.confirm("Cancelar?"))await deleteDoc(doc(db,"churrasqueiras",r.id));}}
                                style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,padding:0,marginLeft:4}}>✕</button>
                            </div>
                          ))
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>}

      {/* ── AGENDAMENTOS ── */}
      {pg==="agend"&&subAgend==="lista"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subAgend} setAba={setSubAgend} tabs={[["lista","📋 Reservas"],["contatos","👥 Contatos"]]}/>
        <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {[["todos","Todos"],["conf","Confirmados"],["aguard","Aguardando"],["canc","Cancelados"],["parcial","50% pagos"],["pago","Quitados"],["avulso","Avulso"],["mensalista","Mensalista"]].map(([k,l])=>(
            <div key={k} onClick={()=>setFiltro(k)} style={{flex:"none",padding:"6px 14px",borderRadius:20,border:`1.5px solid ${filtro===k?V:"#e0e3e8"}`,background:filtro===k?V:"white",fontSize:12,fontWeight:600,cursor:"pointer",color:filtro===k?"white":"#6b7280",whiteSpace:"nowrap"}}>{l}</div>
          ))}
        </div>
        <Card>
          {agFilt.length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:32}}>Nenhum agendamento</div>}
          {agFilt.map(a=>(
            <div key={a.id} style={{padding:14,borderBottom:"1px solid #e0e3e8",opacity:a.st==="cancelado"?0.6:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,cursor:"pointer"}} onClick={()=>abrirEditAg(a)}>
                <div>
                  <div style={{fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:5}}>
                    {a.chuva&&<span title="Reagendado por chuva">🌧️</span>}
                    {a.motivoCancelamento==="chuva"&&<span title="Cancelado por chuva — reagendado">🌧️❌</span>}
                    {a.cli||"Avulso"}
                  </div>
                  <div style={{fontSize:13,color:"#6b7280"}}>{a.qnm} · {fd(a.data)}</div>
                  <div style={{fontSize:13,color:"#6b7280"}}>{a.ini} às {a.fim}{a.pess?` · ${a.pess} pessoas`:""}</div>
                </div>
                <Badge t={a.st||"confirmado"}>{a.st||"confirmado"}</Badge>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <BadgePag ag={a}/>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {a.st==="confirmado"&&<button onClick={e=>{e.stopPropagation();setReagData(a.data);setReagIni(a.ini);setReagFim(a.fim);setModalReag(a);}}
                    style={{background:"#e0f2fe",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,fontWeight:700,cursor:"pointer",color:"#0369a1"}}
                    title="Reagendar por chuva">🌧️ Chuva</button>}
                  <div style={{textAlign:"right"}}>
                    <span style={{fontWeight:700,fontSize:16,color:VE}}>R$ {(a.val||0).toFixed(2)}</span>
                    {isParcial(a.pag)&&<div style={{fontSize:11,color:"#854d0e",marginTop:2}}>falta R$ {(a.val*0.5).toFixed(2)} na chegada</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>}

      {/* ── FINANCEIRO ── */}
      {pg==="fin"&&<div style={{padding:16,paddingBottom:80}}>

        {/* Seletor de período — topo */}
        <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
          {[["mes","📅 Mês"],["semana","7 dias"],["quinzena","15 dias"],["custom","Personalizado"]].map(([k,l])=>(
            <div key={k} onClick={()=>setFinTipo(k)}
              style={{flex:"none",padding:"6px 16px",borderRadius:20,border:`1.5px solid ${finTipo===k?V:"#e0e3e8"}`,background:finTipo===k?V:"white",fontSize:12,fontWeight:600,cursor:"pointer",color:finTipo===k?"white":"#6b7280"}}>
              {l}
            </div>
          ))}
        </div>
        {finTipo==="mes"&&<input type="month" style={{...inp,marginBottom:12}} value={finMes} onChange={e=>setFinMes(e.target.value)}/>}
        {finTipo==="custom"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><label style={lbl}>De</label><input type="date" style={inp} value={finDe} onChange={e=>setFinDe(e.target.value)}/></div>
            <div><label style={lbl}>Até</label><input type="date" style={inp} value={finAte} onChange={e=>setFinAte(e.target.value)}/></div>
          </div>
        )}
        {(finTipo==="semana"||finTipo==="quinzena")&&(
          <div style={{fontSize:12,color:"#6b7280",background:"#f9fafb",padding:"8px 12px",borderRadius:8,marginBottom:12}}>
            📅 {finTipo==="semana"?"Últimos 7 dias":"Últimos 15 dias"} — até hoje
          </div>
        )}

        {/* 1. Resumo do período — 3 cards grandes */}
        {(()=>{
          const totalRecebido = finRec + finParcial;
          const totalAReceber = finPend + finL.filter(a=>isParcial(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+saldoRestante(a),0);
          const totalGeral = totalRecebido + totalAReceber;
          return(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div style={{background:"#f0fdf4",borderRadius:14,padding:14,textAlign:"center",border:"1.5px solid #bbf7d0"}}>
                <div style={{fontWeight:800,fontSize:20,color:"#065f46"}}>R${totalRecebido.toFixed(0)}</div>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:3,textTransform:"uppercase"}}>Recebido</div>
              </div>
              <div style={{background:"#fef2f2",borderRadius:14,padding:14,textAlign:"center",border:"1.5px solid #fca5a5"}}>
                <div style={{fontWeight:800,fontSize:20,color:"#dc2626"}}>R${totalAReceber.toFixed(0)}</div>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:3,textTransform:"uppercase"}}>A Receber</div>
              </div>
              <div style={{background:"white",borderRadius:14,padding:14,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
                <div style={{fontWeight:800,fontSize:20,color:"#1a1f2e"}}>R${totalGeral.toFixed(0)}</div>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:3,textTransform:"uppercase"}}>Total Geral</div>
              </div>
            </div>
          );
        })()}

        {/* 2. Por Canal */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{background:"#eff6ff",borderRadius:12,padding:14,textAlign:"center",border:"1.5px solid #bfdbfe"}}>
            <div style={{fontSize:13,marginBottom:2}}>💻</div>
            <div style={{fontWeight:800,fontSize:18,color:"#1e40af"}}>R${finSite.toFixed(0)}</div>
            <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:2,textTransform:"uppercase"}}>Site</div>
          </div>
          <div style={{background:"#f0fdf4",borderRadius:12,padding:14,textAlign:"center",border:"1.5px solid #bbf7d0"}}>
            <div style={{fontSize:13,marginBottom:2}}>🏟️</div>
            <div style={{fontWeight:800,fontSize:18,color:"#065f46"}}>R${finBalcao.toFixed(0)}</div>
            <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:2,textTransform:"uppercase"}}>Balcão</div>
          </div>
        </div>

        {/* 3. Por Quadra */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{background:"#f0fdf4",borderRadius:12,padding:12,textAlign:"center",border:"1.5px solid #bbf7d0"}}>
            <div style={{fontSize:16,marginBottom:2}}>⚽</div>
            <div style={{fontWeight:800,fontSize:17,color:"#065f46"}}>R${finSociety.toFixed(0)}</div>
            <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:2,textTransform:"uppercase"}}>Society</div>
          </div>
          <div style={{background:"#fff7ed",borderRadius:12,padding:12,textAlign:"center",border:"1.5px solid #fed7aa"}}>
            <div style={{fontSize:16,marginBottom:2}}>🏐</div>
            <div style={{fontWeight:800,fontSize:17,color:"#c2410c"}}>R${finAreia.toFixed(0)}</div>
            <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:2,textTransform:"uppercase"}}>Areia</div>
          </div>
          <div style={{background:"#fef9c3",borderRadius:12,padding:12,textAlign:"center",border:"1.5px solid #fde68a"}}>
            <div style={{fontSize:16,marginBottom:2}}>🧖</div>
            <div style={{fontWeight:800,fontSize:17,color:"#854d0e"}}>R${finSauna.toFixed(0)}</div>
            <div style={{fontSize:10,color:"#6b7280",fontWeight:700,marginTop:2,textTransform:"uppercase"}}>Sauna</div>
          </div>
        </div>

        {/* 4. Por Dia */}
        {finDias.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:11,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Por dia</div>
            {finDias.map(([d,v])=>{
              const recDia=v.site+v.balcao;
              const pendDia=finL.filter(a=>a.data===d&&a.pag==="pendente"&&a.st!=="cancelado").reduce((s,a)=>s+(a.val||0),0)
                           +finL.filter(a=>a.data===d&&isParcial(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+saldoRestante(a),0);
              return(
                <div key={d} style={{background:"white",borderRadius:10,padding:"10px 14px",marginBottom:6,boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a1f2e"}}>
                      {new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                      {v.society>0&&<span style={{fontSize:10,fontWeight:700,color:"#065f46",background:"#f0fdf4",borderRadius:5,padding:"1px 6px"}}>⚽ R${v.society.toFixed(0)}</span>}
                      {v.areia>0&&<span style={{fontSize:10,fontWeight:700,color:"#92400e",background:"#fff7ed",borderRadius:5,padding:"1px 6px"}}>🏐 R${v.areia.toFixed(0)}</span>}
                      {v.sauna>0&&<span style={{fontSize:10,fontWeight:700,color:"#854d0e",background:"#fef9c3",borderRadius:5,padding:"1px 6px"}}>🧖 R${v.sauna.toFixed(0)}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,fontSize:14,color:"#065f46"}}>R${recDia.toFixed(0)}</div>
                    {pendDia>0&&<div style={{fontSize:10,color:"#dc2626",fontWeight:700,marginTop:2}}>⏳ R${pendDia.toFixed(0)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Btn c="v" full onClick={exportarCSV}>⬇️ Exportar CSV</Btn>
      </div>}


      {/* ── CONTATOS ── */}
      {pg==="agend"&&subAgend==="contatos"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subAgend} setAba={setSubAgend} tabs={[["lista","📋 Reservas"],["contatos","👥 Contatos"]]}/>
        {clientesFrequentes.length>0&&(
          <div style={{background:"#fef9c3",border:"1.5px solid #fde047",borderRadius:12,padding:"12px 16px",marginBottom:12}}>
            <div style={{fontWeight:800,fontSize:13,color:"#854d0e",marginBottom:6}}>⭐ Clientes Frequentes (10+ reservas)</div>
            {clientesFrequentes.map(c=>(
              <div key={c.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                <span style={{fontSize:13,fontWeight:600}}>{c.n}</span>
                <span style={{fontSize:12,fontWeight:800,color:"#854d0e",background:"#fef08a",borderRadius:8,padding:"2px 8px"}}>{c.count}x</span>
              </div>
            ))}
          </div>
        )}
        <input style={{...inp,marginBottom:12}} placeholder="🔍 Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <Card>
          {ctsFilt.length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:32}}>Nenhum contato</div>}
          {ctsFilt.map(c=>(
            <div key={c.n} style={{padding:"12px 14px",borderBottom:"1px solid #e0e3e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,fontSize:14}}>{c.n}</span>
                  {c.count>=10&&<span style={{fontSize:10,fontWeight:800,color:"#854d0e",background:"#fef9c3",borderRadius:6,padding:"1px 6px"}}>⭐ {c.count}x</span>}
                </div>
                <div style={{fontSize:12,color:"#6b7280"}}>{c.tel||"Sem telefone"}</div>
                {c.cpf&&<div style={{fontSize:12,color:"#6b7280"}}>CPF: {c.cpf}</div>}
              </div>
              {c.tel&&<a href={`https://wa.me/55${c.tel.replace(/\D/g,"")}`} style={{display:"inline-flex",alignItems:"center",padding:"7px 12px",borderRadius:8,background:V,color:"white",fontSize:12,fontWeight:600,textDecoration:"none"}} target="_blank">WhatsApp</a>}
            </div>
          ))}
        </Card>

        {/* MESCLAR CLIENTES DUPLICADOS */}
        {(()=>{
          // Agrupar clientes por telefone (normalizado) para encontrar duplicatas
          const grupos={};
          ags.forEach(a=>{
            if(!a.cli&&!a.tel) return;
            const tel=(a.tel||"").replace(/\D/g,"");
            const cpf=(a.cpf||"").replace(/\D/g,"");
            const chave=cpf||tel;
            if(!chave) return;
            if(!grupos[chave]) grupos[chave]={ags:[],tel,cpf,nomes:new Set()};
            grupos[chave].ags.push(a);
            if(a.cli) grupos[chave].nomes.add(a.cli.trim().toLowerCase());
          });
          const duplicados=Object.values(grupos).filter(g=>g.nomes.size>1);
          if(duplicados.length===0) return null;
          return(
            <div style={{marginTop:16,background:"#fef2f2",border:"1.5px solid #fca5a5",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontWeight:800,fontSize:13,color:"#dc2626",marginBottom:10}}>🔀 Clientes duplicados ({duplicados.length})</div>
              {duplicados.map((g,i)=>{
                const nomes=[...g.nomes];
                // Principal = nome mais longo e formatado
                const principal=g.ags.sort((a,b)=>(b.cli||"").length-(a.cli||"").length)[0];
                const outros=g.ags.filter(a=>(a.cli||"").trim().toLowerCase()!==principal.cli?.trim().toLowerCase());
                return(
                  <div key={i} style={{padding:"10px 0",borderBottom:"1px solid #fecaca"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1a1f2e",marginBottom:4}}>
                      {nomes.join(" · ")}
                    </div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>
                      {g.tel&&`📱 ${g.tel}`}{g.cpf&&` · CPF ${g.cpf}`} · {g.ags.length} reservas
                    </div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>
                      Unificar como: <strong style={{color:"#1a1f2e"}}>{principal.cli}</strong>
                    </div>
                    <button onClick={()=>mesclarClientes(principal, outros)}
                      style={{background:"#dc2626",color:"white",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      🔀 Mesclar {outros.length} duplicata(s)
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>}

      {/* ── COMPLEXO ── */}
      {pg==="cfg"&&subCfg==="complexo"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subCfg} setAba={setSubCfg} tabs={[["cfg","⚙️ Config"],["complexo","🏟️ Complexo"],["galeria","📸 Galeria"]]}/>
        <Card>
          <CardH title="🏟️ Informações do Complexo"/>
          <div style={{padding:16}}>
            <div style={{marginBottom:14}}><label style={lbl}>Nome do Complexo</label><input style={inp} value={cfg.nome} onChange={e=>setCfg(c=>({...c,nome:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={lbl}>Descrição</label><textarea style={{...inp,resize:"vertical"}} rows={4} value={cfg.descricao||""} onChange={e=>setCfg(c=>({...c,descricao:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={lbl}>Horário de Funcionamento</label><textarea style={{...inp,resize:"vertical"}} rows={3} value={cfg.horarios||""} onChange={e=>setCfg(c=>({...c,horarios:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={lbl}>Tabela de Preços</label><textarea style={{...inp,resize:"vertical"}} rows={4} value={cfg.precos||""} onChange={e=>setCfg(c=>({...c,precos:e.target.value}))}/></div>
          </div>
        </Card>
        <Card>
          <CardH title="📜 Regras do Complexo"/>
          <div style={{padding:16}}>
            <textarea style={{...inp,resize:"vertical"}} rows={8} value={cfg.regras||""} onChange={e=>setCfg(c=>({...c,regras:e.target.value}))}/>
          </div>
        </Card>
        <Btn c="v" full onClick={()=>showToast("✅ Informações salvas!")}>💾 Salvar</Btn>

        {/* BLACKOUT DE DATAS */}
        <div style={{marginTop:20}}>
          <Card>
            <CardH title="🚫 Bloquear Dia Inteiro"/>
            <div style={{padding:16}}>
              <div style={{marginBottom:12}}>
                <label style={lbl}>Data</label>
                <input type="date" style={inp} value={blackoutData} onChange={e=>setBlackoutData(e.target.value)}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>Quadra</label>
                <select style={inp} value={blackoutQid} onChange={e=>setBlackoutQid(e.target.value)}>
                  <option value="todas">Todas as quadras</option>
                  {qds.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}
                </select>
              </div>
              <div style={{marginBottom:14}}>
                <label style={lbl}>Motivo (opcional)</label>
                <input style={inp} value={blackoutMotivo} placeholder="Ex: Feriado, manutenção, chuva..." onChange={e=>setBlackoutMotivo(e.target.value)}/>
              </div>
              <Btn c="r" full onClick={salvarBlackout}>🚫 Bloquear dia inteiro</Btn>
            </div>
          </Card>

          {blackouts.length>0&&(
            <Card>
              <CardH title="Dias bloqueados"/>
              {blackouts.sort((a,b)=>a.data.localeCompare(b.data)).map(b=>(
                <div key={b.id} style={{padding:"12px 14px",borderBottom:"1px solid #e0e3e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#dc2626"}}>🚫 {fd(b.data)}</div>
                    <div style={{fontSize:12,color:"#6b7280"}}>{b.qid==="todas"?"Todas as quadras":(qds.find(x=>x.id===b.qid)?.nome||b.qid)}{b.motivo?" — "+b.motivo:""}</div>
                  </div>
                  <button onClick={()=>removerBlackout(b.id)}
                    style={{background:"none",border:"1.5px solid #dc2626",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,color:"#dc2626",cursor:"pointer"}}>
                    Remover
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>}

      {/* ── GALERIA ── */}
      {pg==="cfg"&&subCfg==="galeria"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subCfg} setAba={setSubCfg} tabs={[["cfg","⚙️ Config"],["complexo","🏟️ Complexo"],["galeria","📸 Galeria"]]}/>
        <Card>
          <CardH title="📸 Galeria de Fotos"/>
          <div style={{padding:16}}>
            <div style={{marginBottom:10}}><label style={lbl}>URL da foto</label><input style={inp} value={novaFotoUrl} onChange={e=>setNovaFotoUrl(e.target.value)} placeholder="https://..."/></div>
            <div style={{marginBottom:10}}><label style={lbl}>Legenda (opcional)</label><input style={inp} value={novaFotoLegenda} onChange={e=>setNovaFotoLegenda(e.target.value)} placeholder="Ex: Quadra de Areia"/></div>
            <button onClick={async()=>{
              if(!novaFotoUrl.trim()){alert("Cole a URL da foto!");return;}
              await addDoc(collection(db,"galeria"),{url:novaFotoUrl.trim(),legenda:novaFotoLegenda.trim(),ordem:galeria.length+1,em:new Date().toISOString()});
              setNovaFotoUrl(""); setNovaFotoLegenda(""); showToast("📸 Foto adicionada!");
            }} style={{width:"100%",padding:"12px",background:V,color:"white",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:16}}>
              ➕ Adicionar foto
            </button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {galeria.map(f=>(
                <div key={f.id} style={{position:"relative"}}>
                  <img src={f.url} alt={f.legenda} style={{width:"100%",height:110,objectFit:"cover",borderRadius:10}}/>
                  {f.legenda&&<div style={{fontSize:11,color:"#6b7280",marginTop:4,textAlign:"center"}}>{f.legenda}</div>}
                  <button onClick={async()=>{if(window.confirm("Remover foto?"))await deleteDoc(doc(db,"galeria",f.id));}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"white",border:"none",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontSize:16}}>✕</button>
                </div>
              ))}
            </div>
            {galeria.length===0&&<div style={{textAlign:"center",color:"#9ca3af",padding:20}}>Nenhuma foto cadastrada ainda.</div>}
          </div>
        </Card>
      </div>}

      {/* ── CONFIG ── */}
      {pg==="cfg"&&subCfg==="cfg"&&<div style={{padding:16,paddingBottom:80}}>
        <SubTabs aba={subCfg} setAba={setSubCfg} tabs={[["cfg","⚙️ Config"],["complexo","🏟️ Complexo"],["galeria","📸 Galeria"]]}/>
        <Card>
          <CardH title="Configurações"/>
          <div style={{padding:16}}>
            <div style={{marginBottom:14}}><label style={lbl}>Chave Pix</label><input style={inp} value={cfg.pix||""} onChange={e=>setCfg(c=>({...c,pix:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={lbl}>WhatsApp</label><input style={inp} value={cfg.wpp||""} onChange={e=>setCfg(c=>({...c,wpp:e.target.value}))}/></div>
            <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"#6b7280",margin:"16px 0 10px"}}>💰 Preços</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{marginBottom:10}}><label style={lbl}>Society — Dia (R$/h)</label><input style={inp} type="number" value={cfg.precoSocietyDia||120} onChange={e=>setCfg(c=>({...c,precoSocietyDia:parseFloat(e.target.value)||120}))}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Society — Noite (R$/h)</label><input style={inp} type="number" value={cfg.precoSocietyNoite||130} onChange={e=>setCfg(c=>({...c,precoSocietyNoite:parseFloat(e.target.value)||130}))}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Areia (R$/h)</label><input style={inp} type="number" value={cfg.precoAreia||60} onChange={e=>setCfg(c=>({...c,precoAreia:parseFloat(e.target.value)||60}))}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Limite sem excedente</label><input style={inp} type="number" value={cfg.limiteAreia||12} onChange={e=>setCfg(c=>({...c,limiteAreia:parseInt(e.target.value)||12}))}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Excedente (R$/pessoa/h)</label><input style={inp} type="number" value={cfg.precoExcedente||10} onChange={e=>setCfg(c=>({...c,precoExcedente:parseFloat(e.target.value)||10}))}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Sauna (R$/pessoa)</label><input style={inp} type="number" value={cfg.precoSauna||15} onChange={e=>setCfg(c=>({...c,precoSauna:parseFloat(e.target.value)||15}))}/></div>
            </div>
          </div>
        </Card>
        <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"#6b7280",margin:"20px 0 10px"}}>Quadras</div>
        {qds.map(q=>(
          <Card key={q.id} style={{marginBottom:8}}>
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:q.cor,display:"inline-block"}}/>
                  {q.nome}
                </div>
                <div style={{fontSize:12,color:"#6b7280"}}>{q.tipo} · {q.cob==="pessoas"?"Por pessoas":"R$"+q.preco+"/h"}</div>
              </div>
              <Btn sm onClick={()=>abrirEditQ(q)}>Editar</Btn>
            </div>
          </Card>
        ))}
        <Btn full onClick={()=>{setEditQ(null);setQNm("");setQTp("Futebol Society");setQPr("");setQCr(V);setQCob("fixo");setModalQ(true);}}>+ Adicionar Quadra</Btn>
        <div style={{height:16}}/>
        <Btn c="v" full onClick={async()=>{
          try {
            await setDoc(doc(db,"config","precos"),{
              precoSocietyDia: cfg.precoSocietyDia||120,
              precoSocietyNoite: cfg.precoSocietyNoite||130,
              horaNoite: cfg.horaNoite||"16:00",
              precoAreia: cfg.precoAreia||60,
              limiteAreia: cfg.limiteAreia||12,
              precoExcedente: cfg.precoExcedente||10,
              precoSauna: cfg.precoSauna||15,
              atualizadoEm: new Date().toISOString()
            });
            showToast("✅ Configurações e preços salvos!");
          } catch(e){ showToast("❌ Erro ao salvar!"); }
        }}>💾 Salvar</Btn>
      </div>}

      {/* FAB */}
      <button style={{position:"fixed",bottom:24,right:20,width:56,height:56,borderRadius:"50%",background:LA,color:"white",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(232,134,26,.4)",zIndex:90,fontSize:28}} onClick={()=>abrirNovoAg()}>+</button>

      {/* MODAL CHURRASQUEIRA */}
      {modalChur&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:400,padding:"24px 20px"}}>
            <div style={{fontWeight:800,fontSize:18,marginBottom:16,color:"#1a1f2e",textAlign:"center"}}>🔥 Reservar Churrasqueira</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Data</label>
              <input type="date" value={churData} onChange={e=>setCHurData(e.target.value)}
                style={{width:"100%",padding:"10px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14}}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Churrasqueira</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{id:"ch1",label:"Chur. 1"},{id:"ch2",label:"Chur. 2"},{id:"cha",label:"Areia"}].map(c=>(
                  <button key={c.id} onClick={()=>setCHurLocal(c.id)}
                    style={{padding:"10px 4px",borderRadius:8,border:`2px solid ${churLocal===c.id?"#ea580c":"#e0e3e8"}`,background:churLocal===c.id?"#fff7ed":"white",fontWeight:700,fontSize:12,cursor:"pointer",color:churLocal===c.id?"#ea580c":"#374151"}}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Nome do cliente</label>
              <input type="text" value={churNome} onChange={e=>setCHurNome(e.target.value)} placeholder="Nome completo"
                style={{width:"100%",padding:"10px",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14}}/>
            </div>
            <button onClick={async()=>{
              if(!churNome.trim()){alert("Informe o nome do cliente!");return;}
              await addDoc(collection(db,"churrasqueiras"),{local:churLocal,data:churData,nome:churNome.trim(),em:new Date().toISOString()});
              setCHurNome("");setModalChur(false);showToast("🔥 Churrasqueira reservada!");
            }} style={{width:"100%",padding:"13px",background:"#ea580c",color:"white",border:"none",borderRadius:10,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:10}}>
              ✅ Confirmar reserva
            </button>
            <button onClick={()=>setModalChur(false)}
              style={{width:"100%",padding:"12px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL AGENDAMENTO ── */}
      <Modal open={modalA} onClose={()=>setModalA(false)}>
        <div style={{fontWeight:800,fontSize:22,marginBottom:16}}>{editAg?"Editar Agendamento":"Novo Agendamento"}</div>
        <div style={{marginBottom:14}}>
          <label style={lbl}>Tipo</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {TIPOS.map((t,i)=><div key={t} onClick={()=>setFTipo(t)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${fTipo===t?V:"#e0e3e8"}`,background:fTipo===t?V:"white",fontSize:13,fontWeight:600,cursor:"pointer",color:fTipo===t?"white":"#6b7280"}}>{TLBL[i]}</div>)}
          </div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Quadra</label>
          <select style={inp} value={fQid} onChange={e=>{setFQid(e.target.value);const q=qds.find(x=>x.id===e.target.value);if(q&&q.cob!=="pessoas")setFVal(String(q.preco||""));else{setFVal("");setFPess("");setHintP("");}}}>
            {qds.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}
          </select>
        </div>
        {qds.find(x=>x.id===fQid)?.cob==="pessoas"&&(
          <div style={{marginBottom:14}}>
            <label style={lbl}>Número de pessoas</label>
            <input type="number" style={inp} value={fPess} placeholder="Ex: 10" onChange={e=>{setFPess(e.target.value);calcAreia(e.target.value,fQid);calcValorAdmin(fIni,fFim,fQid,e.target.value);}}/>
            <div style={{fontSize:11,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"8px 10px",marginTop:6,lineHeight:1.5}}>
              ⚠️ <strong>Conta toda pessoa na extensão da quadra:</strong> quem está jogando, no deck e na churrasqueira privativa.
            </div>
            {hintP&&<div style={{fontSize:13,fontWeight:700,marginTop:8,color:VE,background:"#f0fdf4",padding:"8px 12px",borderRadius:8}}>{hintP}</div>}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Data</label><input type="date" style={inp} value={fData} onChange={e=>setFData(e.target.value)}/></div>
          <div><label style={lbl}>Valor R$ (calculado auto)</label>
            <input type="number" style={{...inp,background:"#f0fdf4",fontWeight:700,color:VE}} value={fVal} placeholder="0,00" step="0.01" onChange={e=>setFVal(e.target.value)}/>
            {fIni&&fFim&&(()=>{
              const[ih,im]=fIni.split(":").map(Number);
              const[fh,fm]=fFim.split(":").map(Number);
              const dur=(fh*60+fm)-(ih*60+im);
              if(dur<=0)return null;
              const h=Math.floor(dur/60),m=dur%60;
              return <div style={{fontSize:11,color:"#16a34a",fontWeight:700,marginTop:3}}>⏱ {h>0?h+"h":""}{m>0?" "+m+"min":""} de duração</div>;
            })()}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Início</label>
            <select style={inp} value={fIni} onChange={e=>{setFIni(e.target.value);calcValorAdmin(e.target.value,fFim,fQid,fPess);}}>
              <option value="">--</option>
              {adminSlots.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Fim</label>
            <select style={inp} value={fFim} onChange={e=>{setFFim(e.target.value);calcValorAdmin(fIni,e.target.value,fQid,fPess);}}>
              <option value="">--</option>
              {adminSlots.filter(s=>!fIni||s>fIni).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Cliente</label><input style={inp} value={fCli} placeholder="Nome completo" onChange={e=>setFCli(e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Telefone/WhatsApp</label><input type="tel" style={inp} value={fTel} placeholder="(22) 9xxxx-xxxx" onChange={e=>setFTel(e.target.value)}/></div>
          <div><label style={lbl}>CPF</label><input style={inp} value={fCpf} placeholder="000.000.000-00" onChange={e=>setFCpf(e.target.value)}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Status</label>
            <select style={inp} value={fSt} onChange={e=>setFSt(e.target.value)}>
              <option value="confirmado">Confirmado</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div><label style={lbl}>Pagamento</label>
            <select style={inp} value={fPag} onChange={e=>setFPag(e.target.value)}>
              <option value="pendente">⏳ Pendente</option>
              <option value="mp_50">💛 50% pago</option>
              <option value="mp_total">✅ 100% quitado</option>
            </select>
          </div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Observações</label><textarea style={{...inp,resize:"vertical"}} rows={2} value={fObs} placeholder="Observações..." onChange={e=>setFObs(e.target.value)}/></div>
        {fTipo==="mensalista"&&!editAg&&(
          <div style={{background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:12,padding:14,marginTop:12}}>
            <Switch on={fRepetir} onChange={setFRepetir} label="🔁 Repetir automaticamente"/>
            {fRepetir&&(
              <div style={{marginTop:12}}>
                <div style={{marginBottom:10}}>
                  <label style={lbl}>Frequência</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["semanal","Semanal"],["quinzenal","Quinzenal"],["mensal","Mensal"]].map(([v,l])=>(
                      <div key={v} onClick={()=>setFRepDia(v)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${fRepDia===v?"#1d4ed8":"#e0e3e8"}`,background:fRepDia===v?"#1d4ed8":"white",color:fRepDia===v?"white":"#374151",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Repetir até</label>
                  <input type="date" style={inp} value={fRepAte} onChange={e=>setFRepAte(e.target.value)} min={fData}/>
                  {fRepAte&&fData&&(()=>{
                    const d1=new Date(fData+"T12:00:00"),d2=new Date(fRepAte+"T12:00:00");
                    const dias=fRepDia==="semanal"?7:fRepDia==="quinzenal"?14:null;
                    let count=0,cur=new Date(d1);
                    while(true){if(dias)cur=new Date(cur.getTime()+dias*24*60*60*1000);else{cur=new Date(cur);cur.setMonth(cur.getMonth()+1);}if(cur>d2)break;count++;}
                    return count>0?<div style={{fontSize:12,color:"#1d4ed8",fontWeight:700,marginTop:6}}>✅ {count+1} reservas serão criadas ({fd(fData)} até {fd(fRepAte)})</div>:null;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{height:14}}/>
        <Btn c="v" full onClick={salvarAg}>Salvar Agendamento</Btn>
        <div style={{height:8}}/>
        <Btn full onClick={()=>setModalA(false)}>Cancelar</Btn>
        {editAg&&<><div style={{height:8}}/><Btn c="azul" full onClick={remarcarAg}>🔄 Remarcar</Btn><div style={{height:8}}/><Btn c="cinza" full onClick={cancelarAg}>❌ Cancelar Agendamento</Btn><div style={{height:8}}/><Btn c="r" full onClick={deletarAg}>🗑️ Excluir</Btn></>}
      </Modal>

      {/* ── MODAL DETALHE ── */}
      <Modal open={!!modalD} onClose={()=>setModalD(null)}>
        {modalD&&<>
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:22}}>{modalD.cli||"Reserva"}</div>
            <div style={{color:"#6b7280",marginTop:4}}>{modalD.qnm} · {fd(modalD.data)}</div>
            <div style={{fontWeight:600,marginTop:4}}>{modalD.ini} às {modalD.fim}{modalD.pess?` · ${modalD.pess} pessoas`:""}</div>
            {modalD.cpf&&<div style={{fontSize:13,color:"#6b7280",marginTop:2}}>CPF: {modalD.cpf}</div>}
            {modalD.tel&&<div style={{fontSize:13,color:"#6b7280"}}>📱 {modalD.tel}</div>}
          </div>

          {/* Breakdown financeiro */}
          <div style={{background:"#f9fafb",borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Financeiro</div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e0e3e8"}}>
              <span style={{fontSize:14,color:"#374151"}}>📊 Valor total</span>
              <span style={{fontWeight:700,fontSize:14,color:VE}}>R$ {(modalD.val||0).toFixed(2)}</span>
            </div>
            {pagoPeloSite(modalD)>0&&(
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e0e3e8"}}>
                <span style={{fontSize:14,color:"#374151"}}>💳 Pago no site</span>
                <span style={{fontWeight:700,fontSize:14,color:"#1e40af"}}>R$ {pagoPeloSite(modalD).toFixed(2)}</span>
              </div>
            )}
            {saldoRestante(modalD)>0&&(
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e0e3e8"}}>
                <span style={{fontSize:14,color:"#374151"}}>💰 Receber no balcão</span>
                <span style={{fontWeight:700,fontSize:14,color:"#92400e"}}>R$ {saldoRestante(modalD).toFixed(2)}</span>
              </div>
            )}
            {modalD.sauna&&(
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e0e3e8"}}>
                <span style={{fontSize:14,color:"#374151"}}>🧖 Sauna</span>
                <span style={{fontWeight:700,fontSize:14,color:"#16a34a"}}>R$ 15,00</span>
              </div>
            )}
            {(saldoRestante(modalD)>0||modalD.sauna)&&(
              <div style={{display:"flex",justifyContent:"space-between",background:"#fef3c7",borderRadius:8,padding:"10px 12px",marginTop:8}}>
                <span style={{fontSize:14,fontWeight:700,color:"#92400e"}}>💰 Total a cobrar no local</span>
                <span style={{fontWeight:800,fontSize:16,color:"#92400e"}}>R$ {(saldoRestante(modalD)+(modalD.sauna?15:0)).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            <Badge t={modalD.st||"confirmado"}>{modalD.st}</Badge>
            <BadgePag ag={modalD}/>
            {modalD.churr&&<Badge t="confirmado">🍖 Churrasqueira</Badge>}
          </div>
          {modalD.obs&&<div style={{background:"#f9fafb",padding:12,borderRadius:8,fontSize:13,marginBottom:16}}><strong>Obs:</strong> {modalD.obs}</div>}

          {/* Histórico de alterações */}
          {(modalD.historico||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>📋 Histórico</div>
              {(modalD.historico||[]).map((h,i)=>(
                <div key={i} style={{background:"#f9fafb",borderRadius:8,padding:"8px 12px",marginBottom:6,fontSize:12}}>
                  <div style={{fontWeight:700,color:"#374151"}}>{h.msg}</div>
                  {h.de&&<div style={{color:"#6b7280",marginTop:2}}>De: {h.de}</div>}
                  {h.para&&<div style={{color:"#6b7280"}}>Para: {h.para}</div>}
                  <div style={{color:"#9ca3af",marginTop:2}}>{new Date(h.em).toLocaleString("pt-BR")}</div>
                </div>
              ))}
            </div>
          )}
          {modalD.tel&&(
            <a href={`https://wa.me/55${modalD.tel.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá ${modalD.cli}! ✅ Reserva confirmada!

🏟️ ${modalD.qnm}
📅 ${fd(modalD.data)}
🕐 ${modalD.ini} às ${modalD.fim}
💰 R$${(modalD.val||0).toFixed(2)}

Até lá! 👋`)}`} target="_blank"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"12px",background:"#16a34a",color:"white",borderRadius:8,fontSize:14,fontWeight:700,textDecoration:"none",marginBottom:8}}>
              💬 Enviar confirmação por WhatsApp
            </a>
          )}
          <Btn full onClick={()=>{setModalD(null);abrirEditAg(modalD);}}>✏️ Editar</Btn>
          <div style={{height:8}}/>
          <Btn full onClick={()=>{setReagData(modalD.data);setReagIni(modalD.ini);setReagFim(modalD.fim);setModalReag(modalD);setModalD(null);}}>🌧️ Reagendar por chuva</Btn>
          <div style={{height:8}}/>
          <Btn full onClick={()=>setModalD(null)}>Fechar</Btn>
        </>}
      </Modal>

      {/* ── MODAL REAGENDAMENTO ── */}
      <Modal open={!!modalReag} onClose={()=>setModalReag(null)}>
        {modalReag&&<>
          <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>🌧️ Reagendar por Chuva</div>
          <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>
            {modalReag.cli} — {modalReag.qnm}<br/>
            Original: {fd(modalReag.data)} {modalReag.ini}–{modalReag.fim}
          </div>
          <div style={{marginBottom:14}}>
            <label style={lbl}>Nova data</label>
            <input type="date" style={inp} value={reagData} onChange={e=>setReagData(e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div>
              <label style={lbl}>Início</label>
              <select style={inp} value={reagIni} onChange={e=>setReagIni(e.target.value)}>
                <option value="">--</option>
                {adminSlots.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Fim</label>
              <select style={inp} value={reagFim} onChange={e=>setReagFim(e.target.value)}>
                <option value="">--</option>
                {adminSlots.filter(s=>!reagIni||s>reagIni).map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <Btn c="v" full onClick={async()=>{
            if(!reagData||!reagIni||!reagFim){showToast("⚠️ Preencha data e horário!");return;}
            try {
              // 1. Criar nova reserva idêntica com nova data/horário
              const novaReserva = {
                qid:modalReag.qid, qnm:modalReag.qnm,
                data:reagData, ini:reagIni, fim:reagFim,
                cli:modalReag.cli, tel:modalReag.tel||"", cpf:modalReag.cpf||"",
                email:modalReag.email||"", obs:modalReag.obs||"",
                pess:modalReag.pess||null, sauna:modalReag.sauna||false,
                saunaQtd:modalReag.saunaQtd||0,
                val:modalReag.val||0, valOriginal:modalReag.valOriginal||modalReag.val||0,
                pag:modalReag.pag||"pendente",
                valPagoOnline:modalReag.valPagoOnline||0,
                pagoMaquina:modalReag.pagoMaquina||0,
                pagoDinheiro:modalReag.pagoDinheiro||0,
                st:"confirmado", tp:modalReag.tp||"avulso",
                origem:"admin", chuva:true,
                chuvaOrigId:modalReag.id,
                criadoEm:agora(),
                historico:[{msg:"🌧️ Criado por reagendamento de chuva",de:fd(modalReag.data)+" "+modalReag.ini+"–"+modalReag.fim,em:agora()}]
              };
              await addDoc(collection(db,"agendamentos"),novaReserva);
              // 2. Cancelar reserva original marcando como chuva
              await updateDoc(doc(db,"agendamentos",modalReag.id),{
                st:"cancelado", motivoCancelamento:"chuva",
                chuvaNovaData:reagData, chuvaNovaIni:reagIni
              });
              addLog("🌧️ Reagendado por chuva: "+modalReag.cli+" — "+modalReag.qnm+" de "+fd(modalReag.data)+" para "+fd(reagData));
              setModalReag(null);
              setReagData(""); setReagIni(""); setReagFim("");
              showToast("✅ Reagendado com sucesso!");
            } catch(e){ showToast("❌ Erro ao reagendar!"); }
          }}>✅ Confirmar reagendamento</Btn>
          <div style={{height:8}}/>
          <Btn full onClick={()=>setModalReag(null)}>Cancelar</Btn>
        </>}
      </Modal>

      {/* ── MODAL BLOQUEIO ── */}
      <Modal open={!!modalB} onClose={()=>setModalB(false)}>
        <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>🔒 Bloquear Dias/Horários</div>

        {/* Quadra */}
        <div style={{marginBottom:14}}><label style={lbl}>Quadra</label>
          <select style={inp} value={bQid} onChange={e=>setBQid(e.target.value)}>
            {qds.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}
            <option value="todas">Todas as quadras</option>
          </select>
        </div>



        {/* Datas */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>"Data início"</label>
            <input type="date" style={inp} value={bData} onChange={e=>setBData(e.target.value)}/>
          </div>
          <div><label style={lbl}>Data fim</label>
            <input type="date" style={inp} value={bDataFim} onChange={e=>setBDataFim(e.target.value)}/>
          </div>
        </div>

        {/* Dias da semana — opcional, deixe em branco para bloquear todos os dias do período */}
        <div style={{marginBottom:14}}>
          <label style={lbl}>Dias da semana (opcional — selecione para filtrar)</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d,i)=>(
              <button key={i} onClick={()=>setBDiasSemana(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}
                style={{padding:"8px 12px",borderRadius:8,border:`2px solid ${bDiasSemana.includes(i)?V:"#e0e3e8"}`,background:bDiasSemana.includes(i)?"#f0fdf4":"white",fontWeight:700,fontSize:13,cursor:"pointer",color:bDiasSemana.includes(i)?V:"#374151"}}>
                {d}
              </button>
            ))}
          </div>
          {bDiasSemana.length===0&&<div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>Sem seleção = bloqueia todos os dias do período</div>}
        </div>

        {/* Horário (opcional) */}
        <div style={{marginBottom:6}}>
          <label style={lbl}>Horário (opcional — deixe em branco para bloquear o dia todo)</label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Início</label>
            <select style={inp} value={bIni} onChange={e=>setBIni(e.target.value)}>
              <option value="">Dia todo</option>
              {bloqueioSlots.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Fim</label>
            <select style={inp} value={bFim} onChange={e=>setBFim(e.target.value)}>
              <option value="">Dia todo</option>
              {bloqueioSlots.filter(s=>!bIni||s>bIni).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginBottom:16}}><label style={lbl}>Motivo (opcional)</label>
          <input style={inp} value={bMotivo} placeholder="Ex: Chuva, manutenção, evento..." onChange={e=>setBMotivo(e.target.value)}/>
        </div>

        <Btn c="v" full onClick={salvarBloqueio}>🔒 Bloquear</Btn>
        <div style={{height:8}}/>
        <Btn full onClick={()=>setModalB(false)}>Cancelar</Btn>
      </Modal>

      {/* ── MODAL QUADRA ── */}
      <Modal open={modalQ} onClose={()=>setModalQ(false)}>
        <div style={{fontWeight:800,fontSize:22,marginBottom:16}}>Quadra</div>
        <div style={{marginBottom:14}}><label style={lbl}>Nome</label><input style={inp} value={qNm} onChange={e=>setQNm(e.target.value)}/></div>
        <div style={{marginBottom:14}}><label style={lbl}>Tipo</label>
          <select style={inp} value={qTp} onChange={e=>setQTp(e.target.value)}>
            {["Futebol Society","Vôlei de Areia","Futevôlei","Poliesportiva","Outro"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Preço base/h</label><input type="number" style={inp} value={qPr} onChange={e=>setQPr(e.target.value)}/></div>
          <div><label style={lbl}>Cor</label><input type="color" style={{...inp,height:42,padding:4}} value={qCr} onChange={e=>setQCr(e.target.value)}/></div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Cobrança</label>
          <select style={inp} value={qCob} onChange={e=>setQCob(e.target.value)}>
            <option value="fixo">Fixo por hora</option><option value="pessoas">Por número de pessoas</option>
          </select>
        </div>
        {qCob==="pessoas"&&(
          <div style={{background:"#f9fafb",padding:12,borderRadius:8,marginBottom:14}}>
            {[[qF1a,setQF1a,qF1v,setQF1v],[qF2a,setQF2a,qF2v,setQF2v]].map(([a,sa,v,sv],i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><label style={lbl}>Até pessoas</label><input type="number" style={inp} value={a} onChange={e=>sa(parseInt(e.target.value))}/></div>
                <div><label style={lbl}>R$/hora</label><input type="number" style={inp} value={v} onChange={e=>sv(parseFloat(e.target.value))}/></div>
              </div>
            ))}
            <div><label style={lbl}>Acima — R$ por pessoa</label><input type="number" style={inp} value={qF3v} onChange={e=>setQF3v(parseFloat(e.target.value))}/></div>
          </div>
        )}
        <Btn c="v" full onClick={salvarQ}>Salvar</Btn>
        <div style={{height:8}}/>
        <Btn full onClick={()=>setModalQ(false)}>Cancelar</Btn>
      </Modal>




        {pg==="hoje"&&subHoje==="fechamento"&&(()=>{
          // ── ABA FECHAMENTO DO DIA ──
          const agsFech=(ags||[]).filter(a=>a.data===dsFech&&a.st==="confirmado");
          const quadraFech=(qid)=>agsFech.filter(a=>a.qid===qid);
          const totalVal=(lista)=>lista.reduce((s,a)=>s+(parseFloat(a.val)||0),0);
          const totalOnline=(lista)=>lista.reduce((s,a)=>s+calcPagoOnline(a),0);
          const totalBalcao=(lista)=>lista.reduce((s,a)=>s+(parseFloat(a.pagoMaquina)||0)+(parseFloat(a.pagoDinheiro)||0),0);
          const totalFalta=(lista)=>lista.reduce((s,a)=>s+saldoRestante(a),0);
          const totalSauna=(lista)=>lista.reduce((s,a)=>s+(parseInt(a.saunaQtd)||0),0)*15;
          const q1=quadraFech("q1"), q2=quadraFech("q2");
          const todos=[...q1,...q2];
          const gTotal=totalVal(todos), gOnline=totalOnline(todos), gBalcao=totalBalcao(todos), gFalta=totalFalta(todos);

          const CardFech=({titulo,lista,cor})=>{
            if(lista.length===0)return null;
            const vTotal=totalVal(lista), vOnline=totalOnline(lista), vBalcao=totalBalcao(lista), vFalta=totalFalta(lista);
            return(
              <div style={{background:"white",borderRadius:12,padding:16,marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                <div style={{fontWeight:800,fontSize:14,color:cor,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{titulo} — {lista.length} jogo{lista.length>1?"s":""}</span>
                  <span style={{fontSize:16,color:"#1a1f2e"}}>R${vTotal.toFixed(0)}</span>
                </div>
                {lista.map((a,i)=>{
                  const online=calcPagoOnline(a);
                  const balcao=(parseFloat(a.pagoMaquina)||0)+(parseFloat(a.pagoDinheiro)||0);
                  const falta=saldoRestante(a);
                  return(
                    <div key={a.id} onClick={()=>setModalD(a)} style={{padding:"10px 0",borderTop:"1px solid #f3f4f6",cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:"#1a1f2e"}}>{a.ini}–{a.fim} · {a.cli||"Avulso"}</div>
                          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>
                            {a.pess?`👥 ${a.pess} pessoas · `:""}
                            {(parseInt(a.saunaQtd)||0)>0?`🧖 sauna · `:""}
                            {a.tp==="balcao"?"balcão":"online"}
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:14,color:"#1a1f2e"}}>R${(a.val||0).toFixed(0)}</div>
                          {falta>0&&<div style={{fontSize:10,color:"#dc2626",fontWeight:700}}>falta R${falta.toFixed(0)}</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap"}}>
                        {online>0&&<span style={{fontSize:10,background:"#eff6ff",color:"#1d4ed8",borderRadius:6,padding:"2px 7px",fontWeight:700}}>💻 Online R${online.toFixed(0)}</span>}
                        {balcao>0&&<span style={{fontSize:10,background:"#f0fdf4",color:"#065f46",borderRadius:6,padding:"2px 7px",fontWeight:700}}>🏟️ Balcão R${balcao.toFixed(0)}</span>}
                        {falta>0&&<span style={{fontSize:10,background:"#fef2f2",color:"#dc2626",borderRadius:6,padding:"2px 7px",fontWeight:700}}>⏳ Pendente R${falta.toFixed(0)}</span>}
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:10,paddingTop:10,borderTop:"2px solid #f3f4f6",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{textAlign:"center",background:"#eff6ff",borderRadius:8,padding:"8px 4px"}}>
                    <div style={{fontWeight:800,fontSize:13,color:"#1d4ed8"}}>R${vOnline.toFixed(0)}</div>
                    <div style={{fontSize:10,color:"#6b7280"}}>Online</div>
                  </div>
                  <div style={{textAlign:"center",background:"#f0fdf4",borderRadius:8,padding:"8px 4px"}}>
                    <div style={{fontWeight:800,fontSize:13,color:"#065f46"}}>R${vBalcao.toFixed(0)}</div>
                    <div style={{fontSize:10,color:"#6b7280"}}>Balcão</div>
                  </div>
                  <div style={{textAlign:"center",background:vFalta>0?"#fef2f2":"#f9fafb",borderRadius:8,padding:"8px 4px"}}>
                    <div style={{fontWeight:800,fontSize:13,color:vFalta>0?"#dc2626":"#9ca3af"}}>R${vFalta.toFixed(0)}</div>
                    <div style={{fontSize:10,color:"#6b7280"}}>Pendente</div>
                  </div>
                </div>
              </div>
            );
          };

          return(
            <div style={{padding:16,paddingBottom:80}}>
              {/* Seletor de data */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <button onClick={()=>{const d=new Date(dsFech+"T12:00:00");d.setDate(d.getDate()-1);setDsFech(toDS(d));}} style={{background:"white",border:"1.5px solid #e0e3e8",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:18}}>‹</button>
                <input type="date" value={dsFech} onChange={e=>setDsFech(e.target.value)} style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1.5px solid #e0e3e8",fontSize:14,fontWeight:700,color:"#1a1f2e"}}/>
                <button onClick={()=>{const d=new Date(dsFech+"T12:00:00");d.setDate(d.getDate()+1);setDsFech(toDS(d));}} style={{background:"white",border:"1.5px solid #e0e3e8",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:18}}>›</button>
              </div>

              {todos.length===0?(
                <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📭</div>
                  <div style={{fontWeight:700,fontSize:16}}>Nenhum jogo neste dia</div>
                </div>
              ):(
                <>
                  {/* Resumo geral */}
                  <div style={{background:"linear-gradient(135deg,#1a5248,#2E7D6B)",borderRadius:14,padding:16,marginBottom:16,color:"white"}}>
                    <div style={{fontWeight:800,fontSize:16,marginBottom:12}}>📆 Fechamento do Dia</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                      <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:12,textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:22}}>{todos.length}</div>
                        <div style={{fontSize:11,opacity:.7}}>jogos</div>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:12,textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:22}}>R${gTotal.toFixed(0)}</div>
                        <div style={{fontSize:11,opacity:.7}}>total do dia</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:15}}>R${gOnline.toFixed(0)}</div>
                        <div style={{fontSize:10,opacity:.7}}>💻 Online</div>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:15}}>R${gBalcao.toFixed(0)}</div>
                        <div style={{fontSize:10,opacity:.7}}>🏟️ Balcão</div>
                      </div>
                      <div style={{background:gFalta>0?"rgba(220,38,38,0.3)":"rgba(255,255,255,0.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:15}}>R${gFalta.toFixed(0)}</div>
                        <div style={{fontSize:10,opacity:.7}}>⏳ Pendente</div>
                      </div>
                    </div>
                  </div>

                  {/* Por quadra */}
                  <CardFech titulo="⚽ Campo Society" lista={q1} cor="#2E7D6B"/>
                  <CardFech titulo="🏐 Quadra de Areia" lista={q2} cor="#E8861A"/>

                  {/* Sauna */}
                  {(totalSauna(todos))>0&&(
                    <div style={{background:"white",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:700,fontSize:14}}>🧖 Sauna</span>
                        <span style={{fontWeight:800,fontSize:16,color:"#2E7D6B"}}>R${totalSauna(todos).toFixed(0)}</span>
                      </div>
                      <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>
                        {todos.filter(a=>(parseInt(a.saunaQtd)||0)>0).map(a=>`${a.cli||"Avulso"} (${a.saunaQtd}p)`).join(" · ")}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

      <Toast msg={toast}/>
    </div>
  );
}
