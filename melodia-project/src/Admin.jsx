import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

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
  descricao:"Um campo em grama sintética e uma quadra de areia disponíveis para aluguel todos os dias da semana.\nFuncionamento da Sauna: Segunda a Sexta de 17h às 22h · Sábado 9h às 16h.\nReserva de Churrasqueira: (22) 99900-8085.\nNÃO é permitida a entrada de crianças nas quadras.",
  horarios:"Segunda a Sexta: 16h às 23h (Sauna: 18h às 22h)\nSábado e Domingo: 9h às 18h (Sauna: 10h às 17h)",
  regras:"🏖️ REGRAS EXCLUSIVAS DA QUADRA DE AREIA\n\n1. Área Reservada Exclusiva\nA locação da Quadra de Areia inclui o uso exclusivo da quadra, do deck e da churrasqueira da área reservada. Durante o período contratado, esses espaços ficam destinados exclusivamente aos participantes da locação. Para utilização da churrasqueira exclusiva, o período mínimo de locação é de 5 horas.\n\n2. Participantes da Locação\nSão considerados participantes todas as pessoas que utilizarem a área reservada da Quadra de Areia (quadra, deck e churrasqueira), independentemente de estarem jogando.\n\n⚠️ REGRAS GERAIS DO COMPLEXO\n\n3. Consumo no Local\nNão é permitida a entrada de bebidas. O consumo deverá ser realizado através do bar do complexo.\n\n4. Crianças\nPor questões de segurança, não é permitida a permanência de crianças nas quadras durante os jogos.\n\n5. Eventos e Comemorações\nA locação das quadras destina-se à prática esportiva e confraternização entre os participantes da reserva. Aniversários, confraternizações, eventos corporativos, comemorações e reuniões com convidados externos possuem condições e valores específicos e devem ser contratados separadamente.\n\n6. Confirmação\nAo concluir a reserva, você declara estar ciente e de acordo com as regras acima.",
  precos:"Quadra Society: R$130/hora\nQuadra Areia até 8 pessoas: R$60/hora\nQuadra Areia 9-12 pessoas: R$70/hora\nQuadra Areia a partir de 13 pessoas: R$70 + R$10 por pessoa acima de 12\nEx: 13 pessoas = R$80/h · 14 pessoas = R$90/h · 15 pessoas = R$100/h"
};

function fd(s){if(!s)return"";const[a,m,d]=s.split("-");return`${d}/${m}/${a}`;}
function hoje(){const d=new Date();d.setHours(0,0,0,0);return d;}
function toDS(d){return d.toISOString().split("T")[0];}
function agora(){return new Date().toISOString();}

// Calcula saldo a receber na chegada
function saldoRestante(ag){
  if(!ag) return 0;
  const val=parseFloat(ag.val)||0;
  if(isPago(ag.pag)) return 0;
  if(isParcial(ag.pag)) return val*0.5;
  if(ag.pag==="pendente") return val;
  return 0;
}

function labelPag(pag,val){
  const v=parseFloat(val)||0;
  const map={
    pendente:"⏳ Pendente",
    mp_50:`💛 50% pago — falta R$${(v*0.5).toFixed(2)}`,
    mp_total:"✅ Quitado",
  };
  return map[pag]||pag;
}

function isPago(pag){ return pag==="mp_total"; }
function isParcial(pag){ return pag==="mp_50"; }

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

function BadgePag({pag,val}){
  if(isPago(pag)) return <Badge t="quitado">{labelPag(pag,val)}</Badge>;
  if(isParcial(pag)) return <Badge t="parcial">{labelPag(pag,val)}</Badge>;
  return <Badge t="receber">{labelPag(pag,val)}</Badge>;
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

export default function App(){
  const [pg,setPg]=useState("agenda");
  const [ags,setAgs]=useState([]);
  const [bloqueios,setBloqueios]=useState([]);
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
  const [busca,setBusca]=useState("");

  // Carrega agendamentos do Firebase em tempo real
  useEffect(()=>{
    try {
      const unsub = onSnapshot(collection(db,"agendamentos"), snap=>{
        setAgs(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      return ()=>unsub();
    } catch(e){ console.log("Firebase offline",e); }
  },[]);

  // form agendamento
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

  // form bloqueio
  const [bQid,setBQid]=useState(qds[0]?.id||"");
  const [bData,setBData]=useState(toDS(hoje()));
  const [bIni,setBIni]=useState("");
  const [bFim,setBFim]=useState("");
  const [bMotivo,setBMotivo]=useState("");

  // form quadra
  const [qNm,setQNm]=useState("");const [qTp,setQTp]=useState("Futebol Society");
  const [qPr,setQPr]=useState("");const [qCr,setQCr]=useState(V);const [qCob,setQCob]=useState("fixo");
  const [qF1a,setQF1a]=useState(8);const [qF1v,setQF1v]=useState(60);
  const [qF2a,setQF2a]=useState(12);const [qF2v,setQF2v]=useState(70);const [qF3v,setQF3v]=useState(10);

  function showToast(m){setToast(m);setTimeout(()=>setToast(""),2800);}

  function addLog(msg){
    setCfg(c=>({...c,logs:[{msg,em:agora()},...(c.logs||[])].slice(0,50)}));
  }

  // cálculo areia
  function calcAreia(n,qid){
    const q=qds.find(x=>x.id===(qid||fQid));
    if(!q||q.cob!=="pessoas"||!n||parseInt(n)<=0){setHintP("");return 0;}
    const num=parseInt(n);
    const fx=q.fx||[];
    const faixa=fx.find(x=>num<=x.a);
    if(faixa){
      setHintP(`${num} pessoa${num>1?"s":""} → R$${faixa.v}/hora`);
      setFVal(String(faixa.v));return faixa.v;
    }
    const ex=q.fxExtra;
    if(ex){
      const extra=num-ex.base;
      const total=ex.valorBase+(extra*ex.acrescimo);
      setHintP(`${num} pessoas → R$${ex.valorBase} + ${extra}×R$${ex.acrescimo} = R$${total}/hora`);
      setFVal(String(total));return total;
    }
    return 0;
  }

  function calcValorAdmin(ini, fim, qid) {
    if (!ini || !fim) return;
    const q = qds.find(x=>x.id===qid);
    if (!q || q.cob==="pessoas") return;
    const [ih,im] = ini.split(":").map(Number);
    const [fh,fm] = fim.split(":").map(Number);
    const durMin = (fh*60+fm) - (ih*60+im);
    if (durMin <= 0) return;
    const precoPorHora = q.cob==="horario" && ini >= (q.horarioNoite||"16:00") ? (q.precoNoite||q.preco) : q.preco;
    const total = (precoPorHora / 60) * durMin;
    setFVal(total.toFixed(2));
  }

  function abrirNovoAg(qid,ini,fim,ds){
    setEditAg(null);
    setFTipo("avulso");setFQid(qid||qds[0]?.id||"");
    setFData(ds||toDS(dtA));setFIni(ini||"");setFFim(fim||"");
    setFCli("");setFTel("");setFCpf("");setFVal("");setFPess("");setHintP("");
    setFSt("confirmado");setFPag("pendente");setFObs("");setFChurr(false);
    if(qid&&ini&&fim) calcValorAdmin(ini,fim,qid);
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
    const o={tp:fTipo,qid:fQid,qnm:q?.nome||"",data:fData,ini:fIni,fim:fFim,cli:fCli,tel:fTel,cpf:fCpf,val:parseFloat(fVal)||0,pess:parseInt(fPess)||null,st:fSt,pag:fPag,obs:fObs,churr:fChurr,criadoEm:serverTimestamp()};
    try {
      if(editAg){
        await updateDoc(doc(db,"agendamentos",editAg.id),o);
        addLog(`✏️ Agendamento editado: ${fCli||"Avulso"} — ${q?.nome} ${fd(fData)} ${fIni}`);
      } else {
        await addDoc(collection(db,"agendamentos"),o);
        addLog(`📅 Novo agendamento: ${fCli||"Avulso"} — ${q?.nome} ${fd(fData)} ${fIni}`);
        if(fTel){
          const msg=encodeURIComponent(`Olá ${fCli}! ✅ Sua reserva foi confirmada!\n\n🏟️ ${q?.nome}\n📅 ${fd(fData)}\n🕐 ${fIni} às ${fFim}\n💰 R$${parseFloat(fVal)||0}\n\nQualquer dúvida, fale conosco. Até lá! 👋`);
          window.open(`https://wa.me/55${fTel.replace(/\D/g,"")}?text=${msg}`,"_blank");
        }
      }
      setModalA(false);showToast("✅ Agendamento salvo!");
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
    const novaData = prompt("Nova data (AAAA-MM-DD):", editAg?.data||"");
    if (!novaData) return;
    const novoIni = prompt("Novo horário início (HH:MM):", editAg?.ini||"");
    if (!novoIni) return;
    const novoFim = prompt("Novo horário fim (HH:MM):", editAg?.fim||"");
    if (!novoFim) return;
    const a = ags.find(x=>x.id===editAg.id);
    try {
      await updateDoc(doc(db,"agendamentos",editAg.id),{
        data: novaData,
        ini: novoIni,
        fim: novoFim,
        remarcado: true,
        dataOriginal: a?.data||"",
        iniOriginal: a?.ini||""
      });
      addLog("🔄 Agendamento remarcado: "+(a?.cli||"Avulso")+" — "+a?.qnm+" de "+fd(a?.data)+" "+a?.ini+" para "+fd(novaData)+" "+novoIni);
      setModalA(false);
      showToast("🔄 Agendamento remarcado!");
    } catch(e){ showToast("❌ Erro ao remarcar"); }
  }
async function cancelarAg(){
    if(!confirm("Cancelar este agendamento?"))return;
    const a=ags.find(x=>x.id===editAg.id);
    try {
      await updateDoc(doc(db,"agendamentos",editAg.id),{st:"cancelado"});
      addLog(`❌ Agendamento cancelado: ${a?.cli||"Avulso"} — ${a?.qnm} ${fd(a?.data)} ${a?.ini}`);
      setModalA(false);showToast("❌ Agendamento cancelado");
    } catch(e){ showToast("❌ Erro ao cancelar!"); }
  }

  function salvarBloqueio(){
    if(!bData||!bIni||!bFim){showToast("⚠️ Preencha todos os campos!");return;}
    const q=qds.find(x=>x.id===bQid);
    const b={id:"bl_"+Date.now(),qid:bQid,qnm:q?.nome||"",data:bData,ini:bIni,fim:bFim,motivo:bMotivo,em:agora()};
    setBloqueios(prev=>[b,...prev]);
    addLog(`🔒 Horário bloqueado: ${q?.nome} ${fd(bData)} ${bIni}–${bFim}${bMotivo?" ("+bMotivo+")":""}`);
    setModalB(false);setBMotivo("");setBIni("");setBFim("");
    showToast("🔒 Horário bloqueado!");
  }

  function desbloqueio(id){
    const b=bloqueios.find(x=>x.id===id);
    setBloqueios(prev=>prev.filter(x=>x.id!==id));
    addLog(`🔓 Horário desbloqueado: ${b?.qnm} ${fd(b?.data)} ${b?.ini}–${b?.fim}`);
    showToast("🔓 Horário desbloqueado");
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

  // stats
  const hjDS=toDS(hoje());
  const mes=hoje().getMonth(),ano=hoje().getFullYear();
  const sHoje=ags.filter(a=>a.data===hjDS&&a.st!=="cancelado").length;
  const sMes=ags.filter(a=>{const d=new Date(a.data);return d.getMonth()===mes&&d.getFullYear()===ano&&a.st!=="cancelado";}).length;
  const sRec=ags.filter(a=>!isPago(a.pag)&&a.st!=="cancelado").reduce((s,a)=>s+saldoRestante(a),0);
  const sRecm=ags.filter(a=>{const d=new Date(a.data);return d.getMonth()===mes&&d.getFullYear()===ano&&isPago(a.pag);}).reduce((s,a)=>s+(a.val||0),0);

  // agenda
  const ds=toDS(dtA);
  const ddDia=ags.filter(a=>a.data===ds&&a.st!=="cancelado");
  const blDia=bloqueios.filter(b=>b.data===ds);

  // agendamentos filtrados
  let agFilt=[...ags].sort((a,b)=>b.data.localeCompare(a.data));
  if(filtro==="avulso"||filtro==="mensalista")agFilt=agFilt.filter(a=>a.tp===filtro);
  else if(filtro==="conf")agFilt=agFilt.filter(a=>a.st==="confirmado");
  else if(filtro==="canc")agFilt=agFilt.filter(a=>a.st==="cancelado");
  else if(filtro==="rec")agFilt=agFilt.filter(a=>a.pag==="pendente"&&a.st!=="cancelado");
  else if(filtro==="parcial")agFilt=agFilt.filter(a=>isParcial(a.pag)&&a.st!=="cancelado");
  else if(filtro==="pago")agFilt=agFilt.filter(a=>isPago(a.pag));

  // financeiro
  const finL=ags.filter(a=>{if(!finMes)return true;const[y,m]=finMes.split("-");return a.data?.startsWith(`${y}-${m}`);});
  const finRec=finL.filter(a=>isPago(a.pag)).reduce((s,a)=>s+(a.val||0),0);
  const finParcial=finL.filter(a=>isParcial(a.pag)).reduce((s,a)=>s+(a.val*0.5),0);
  const finPend=finL.filter(a=>a.pag==="pendente"&&a.st!=="cancelado").reduce((s,a)=>s+(a.val||0),0);

  // contatos
  const ctMap={};
  ags.forEach(a=>{if(a.cli)ctMap[a.cli]={tel:a.tel||"",cpf:a.cpf||""};});
  const cts=Object.entries(ctMap).map(([n,d])=>({n,...d}));
  const ctsFilt=busca?cts.filter(c=>c.n.toLowerCase().includes(busca.toLowerCase())):cts;

  const TABS=[{id:"agenda",lbl:"📅 Agenda"},{id:"painel",lbl:"📊 Painel"},{id:"agend",lbl:"📋 Agend."},{id:"fin",lbl:"💰 Fin."},{id:"cont",lbl:"👥 Contatos"},{id:"complexo",lbl:"🏟️ Complexo"},{id:"cfg",lbl:"⚙️ Config"}];
  const TIPOS=["avulso","mensalista","escola","evento"];
  const TLBL=["● Avulso","↺ Mensalista","👥 Escola","🎉 Evento"];

  function SlotAgenda({q}){
    const dq=ddDia.filter(a=>a.qid===q.id);
    const bq=blDia.filter(b=>b.qid===q.id);
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
          const ag=dq.find(x=>x.ini<=hr&&x.fim>hr);
          const bl=bq.find(x=>x.ini<=hr&&x.fim>hr);
          if(ag&&ag.ini!==hr)return null;
          if(bl&&bl.ini!==hr)return null;
          if(bl)return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,border:"1.5px solid #e5e7eb",background:"#f9fafb",cursor:"pointer"}} onClick={()=>desbloqueio(bl.id)}>
              <div style={{fontWeight:700,fontSize:14,minWidth:105,color:"#6b7280"}}>{bl.ini}–{bl.fim}</div>
              <div style={{flex:1,fontSize:13,color:"#6b7280"}}>🔒 Bloqueado{bl.motivo?" — "+bl.motivo:""}</div>
              <span style={{fontSize:11,color:"#9ca3af"}}>toque p/ desbloquear</span>
            </div>
          );
          if(ag)return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,cursor:"pointer",border:"1.5px solid #fed7aa",background:"#fff7ed"}} onClick={()=>setModalD(ag)}>
              <div style={{fontWeight:700,fontSize:14,minWidth:105,color:"#9a3412"}}>{ag.ini}–{ag.fim}</div>
              <div style={{flex:1,fontSize:13}}>
                <div style={{fontWeight:600}}>{ag.cli||"Reservado"}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{ag.tp}{ag.pess?` · ${ag.pess} pess.`:""} · {isPago(ag.pag)?"✅ Quitado":isParcial(ag.pag)?"💛 50% pago":"⏳ A receber"}</div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:VE}}>R${(ag.val||0).toFixed(0)}</div>
            </div>
          );
          return(
            <div key={hr} style={{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,cursor:"pointer",border:"1.5px solid #bbf7d0",background:"#f0fdf4"}} onClick={()=>abrirNovoAg(q.id,hr,hf,ds)}>
              <div style={{fontWeight:700,fontSize:14,minWidth:105,color:VE}}>{hr}</div>
              <div style={{fontSize:13,color:"#16a34a"}}>Livre — toque para reservar</div>
            </div>
          );
        })}
      </div>
    );
  }

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>

      {/* TOPBAR */}
      <div style={{background:VE,color:"white",padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,.2)"}}>
        <div style={{fontWeight:800,fontSize:18,display:"flex",alignItems:"center",gap:8}}>⚽ MELODIA <span style={{color:LA}}>QUADRAS</span></div>
        <span style={{background:LA,color:"white",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,textTransform:"uppercase"}}>Admin</span>
      </div>

      {/* TABS */}
      <div style={{background:"white",display:"flex",borderBottom:"2px solid #e0e3e8",overflowX:"auto",position:"sticky",top:56,zIndex:99}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setPg(t.id)} style={{flex:"none",padding:"12px 14px",fontSize:13,fontWeight:600,color:pg===t.id?V:"#6b7280",cursor:"pointer",border:"none",background:"none",borderBottom:pg===t.id?`3px solid ${V}`:"3px solid transparent",marginBottom:-2,whiteSpace:"nowrap"}}>{t.lbl}</button>)}
      </div>

      {/* ── AGENDA ── */}
      {pg==="agenda"&&<div style={{padding:16,paddingBottom:80}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={{width:36,height:36,borderRadius:8,border:"1.5px solid #e0e3e8",background:"white",cursor:"pointer",fontSize:18}} onClick={()=>setDtA(d=>{const n=new Date(d);n.setDate(n.getDate()-1);return n;})}>‹</button>
          <div style={{flex:1,textAlign:"center",fontWeight:700,fontSize:15,textTransform:"uppercase"}}>
            {dtA.toDateString()===hoje().toDateString()?"Hoje, "+dtA.toLocaleDateString("pt-BR",{day:"numeric",month:"short"}):dtA.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}
          </div>
          <button style={{width:36,height:36,borderRadius:8,border:"1.5px solid #e0e3e8",background:"white",cursor:"pointer",fontSize:18}} onClick={()=>setDtA(d=>{const n=new Date(d);n.setDate(n.getDate()+1);return n;})}>›</button>
          <Btn sm onClick={()=>setDtA(hoje())}>Hoje</Btn>
        </div>
        {qds.map(q=><SlotAgenda key={q.id} q={q}/>)}
      </div>}

      {/* ── PAINEL ── */}
      {pg==="painel"&&<div style={{padding:16,paddingBottom:80}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          {[["Hoje",sHoje],["Este Mês",sMes],["A Receber","R$"+sRec.toFixed(0)],["Recebido Mês","R$"+sRecm.toFixed(0)]].map(([l,v])=>(
            <div key={l} style={{background:"white",borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:28,color:VE}}>{v}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2,fontWeight:600}}>{l}</div>
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
      </div>}

      {/* ── AGENDAMENTOS ── */}
      {pg==="agend"&&<div style={{padding:16,paddingBottom:80}}>
        <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {[["todos","Todos"],["conf","Confirmados"],["canc","Cancelados"],["parcial","50% pagos"],["pago","Quitados"],["avulso","Avulso"],["mensalista","Mensalista"]].map(([k,l])=>(
            <div key={k} onClick={()=>setFiltro(k)} style={{flex:"none",padding:"6px 14px",borderRadius:20,border:`1.5px solid ${filtro===k?V:"#e0e3e8"}`,background:filtro===k?V:"white",fontSize:12,fontWeight:600,cursor:"pointer",color:filtro===k?"white":"#6b7280",whiteSpace:"nowrap"}}>{l}</div>
          ))}
        </div>
        <Card>
          {agFilt.length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:32}}>Nenhum agendamento</div>}
          {agFilt.map(a=>(
            <div key={a.id} style={{padding:14,borderBottom:"1px solid #e0e3e8",cursor:"pointer",opacity:a.st==="cancelado"?0.6:1}} onClick={()=>abrirEditAg(a)}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>{a.cli||"Avulso"}</div>
                  <div style={{fontSize:13,color:"#6b7280"}}>{a.qnm} · {fd(a.data)}</div>
                  <div style={{fontSize:13,color:"#6b7280"}}>{a.ini} às {a.fim}{a.pess?` · ${a.pess} pessoas`:""}</div>
                </div>
                <Badge t={a.st||"confirmado"}>{a.st||"confirmado"}</Badge>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <BadgePag pag={a.pag} val={a.val}/>
                <div style={{textAlign:"right"}}>
                  <span style={{fontWeight:700,fontSize:16,color:VE}}>R$ {(a.val||0).toFixed(2)}</span>
                  {isParcial(a.pag)&&<div style={{fontSize:11,color:"#854d0e",marginTop:2}}>falta R$ {(a.val*0.5).toFixed(2)} na chegada</div>}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>}

      {/* ── FINANCEIRO ── */}
      {pg==="fin"&&<div style={{padding:16,paddingBottom:80}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{background:"white",borderRadius:12,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}><div style={{fontWeight:800,fontSize:22,color:"#065f46"}}>R${finRec.toFixed(0)}</div><div style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Quitado</div></div>
          <div style={{background:"white",borderRadius:12,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}><div style={{fontWeight:800,fontSize:22,color:"#854d0e"}}>R${finParcial.toFixed(0)}</div><div style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Falta 50%</div></div>
          <div style={{background:"white",borderRadius:12,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}><div style={{fontWeight:800,fontSize:22,color:VM}}>R${finPend.toFixed(0)}</div><div style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Não pago</div></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={lbl}>Mês</label>
          <input type="month" style={inp} value={finMes} onChange={e=>setFinMes(e.target.value)}/>
        </div>
        <Card>
          <CardH title="Pagamentos"/>
          {[...finL].sort((a,b)=>b.data.localeCompare(a.data)).map(a=>(
            <div key={a.id} style={{padding:"12px 14px",borderBottom:"1px solid #e0e3e8",display:"flex",alignItems:"center",justifyContent:"space-between",opacity:a.st==="cancelado"?0.5:1}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{a.cli||"Avulso"}{a.st==="cancelado"?" (cancelado)":""}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>{a.qnm} · {fd(a.data)} {a.ini}</div>
                <BadgePag pag={a.pag} val={a.val}/>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:isPago(a.pag)?"#065f46":isParcial(a.pag)?"#854d0e":VM,fontSize:15}}>R$ {(a.val||0).toFixed(2)}</div>
                {isParcial(a.pag)&&<div style={{fontSize:11,color:"#854d0e"}}>falta R${((a.val||0)*0.5).toFixed(2)}</div>}
              </div>
            </div>
          ))}
          {finL.length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:32}}>Nenhum registro</div>}
        </Card>
      </div>}

      {/* ── CONTATOS ── */}
      {pg==="cont"&&<div style={{padding:16,paddingBottom:80}}>
        <input style={{...inp,marginBottom:12}} placeholder="🔍 Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <Card>
          {ctsFilt.length===0&&<div style={{textAlign:"center",color:"#6b7280",padding:32}}>Nenhum contato</div>}
          {ctsFilt.map(c=>(
            <div key={c.n} style={{padding:"12px 14px",borderBottom:"1px solid #e0e3e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{c.n}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>{c.tel||"Sem telefone"}</div>
                {c.cpf&&<div style={{fontSize:12,color:"#6b7280"}}>CPF: {c.cpf}</div>}
              </div>
              {c.tel&&<a href={`https://wa.me/55${c.tel.replace(/\D/g,"")}`} style={{display:"inline-flex",alignItems:"center",padding:"7px 12px",borderRadius:8,background:V,color:"white",fontSize:12,fontWeight:600,textDecoration:"none"}} target="_blank">WhatsApp</a>}
            </div>
          ))}
        </Card>
      </div>}

      {/* ── COMPLEXO ESPORTIVO ── */}
      {pg==="complexo"&&<div style={{padding:16,paddingBottom:80}}>
        <Card>
          <CardH title="🏟️ Informações do Complexo"/>
          <div style={{padding:16}}>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Nome do Complexo</label>
              <input style={inp} value={cfg.nome} onChange={e=>setCfg(c=>({...c,nome:e.target.value}))}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Descrição</label>
              <textarea style={{...inp,resize:"vertical"}} rows={4} value={cfg.descricao||""} onChange={e=>setCfg(c=>({...c,descricao:e.target.value}))}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Horário de Funcionamento</label>
              <textarea style={{...inp,resize:"vertical"}} rows={3} value={cfg.horarios||""} onChange={e=>setCfg(c=>({...c,horarios:e.target.value}))}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Tabela de Preços</label>
              <textarea style={{...inp,resize:"vertical"}} rows={4} value={cfg.precos||""} onChange={e=>setCfg(c=>({...c,precos:e.target.value}))}/>
            </div>
          </div>
        </Card>
        <Card>
          <CardH title="📜 Regras do Complexo"/>
          <div style={{padding:16}}>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:10}}>O cliente precisará aceitar estas regras antes de reservar.</div>
            <textarea style={{...inp,resize:"vertical"}} rows={8} value={cfg.regras||""} onChange={e=>setCfg(c=>({...c,regras:e.target.value}))}/>
          </div>
        </Card>
        <Btn c="v" full onClick={()=>showToast("✅ Informações salvas!")}>💾 Salvar</Btn>
      </div>}

      {/* ── CONFIG ── */}
      {pg==="cfg"&&<div style={{padding:16,paddingBottom:80}}>
        <Card>
          <CardH title="Configurações"/>
          <div style={{padding:16}}>
            <div style={{marginBottom:14}}><label style={lbl}>Chave Pix</label><input style={inp} value={cfg.pix||""} onChange={e=>setCfg(c=>({...c,pix:e.target.value}))}/><div style={{fontSize:11,color:"#6b7280",marginTop:4}}>Exibida ao cliente na hora do pagamento</div></div>
            <div style={{marginBottom:14}}><label style={lbl}>WhatsApp</label><input style={inp} value={cfg.wpp||""} onChange={e=>setCfg(c=>({...c,wpp:e.target.value}))}/></div>
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
        <Btn c="v" full onClick={()=>showToast("✅ Configurações salvas!")}>💾 Salvar</Btn>
      </div>}

      {/* FAB */}
      <button style={{position:"fixed",bottom:24,right:20,width:56,height:56,borderRadius:"50%",background:LA,color:"white",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(232,134,26,.4)",zIndex:90,fontSize:28}} onClick={()=>abrirNovoAg()}>+</button>

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
            <input type="number" style={inp} value={fPess} placeholder="Ex: 10" onChange={e=>{setFPess(e.target.value);calcAreia(e.target.value,fQid);}}/>
            <div style={{fontSize:11,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"8px 10px",marginTop:6,lineHeight:1.5}}>
              ⚠️ <strong>Conta toda pessoa na extensão da quadra:</strong> quem está jogando, no deck e na churrasqueira privativa. Quem fica na arquibancada não conta.
            </div>
            {hintP&&<div style={{fontSize:13,fontWeight:700,marginTop:8,color:VE,background:"#f0fdf4",padding:"8px 12px",borderRadius:8}}>{hintP}</div>}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Data</label><input type="date" style={inp} value={fData} onChange={e=>setFData(e.target.value)}/></div>
          <div><label style={lbl}>Valor R$</label>
            <input type="number" style={{...inp,background:"#f9fafb"}} value={fVal} placeholder="0,00" step="0.01" onChange={e=>setFVal(e.target.value)}/>
            <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>Calculado automaticamente</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Início</label><input type="time" style={inp} value={fIni} onChange={e=>{setFIni(e.target.value);calcValorAdmin(e.target.value,fFim,fQid);}}/></div>
          <div><label style={lbl}>Fim</label><input type="time" style={inp} value={fFim} onChange={e=>{setFFim(e.target.value);calcValorAdmin(fIni,e.target.value,fQid);}}/></div>
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
              <option value="mp_50">💛 50% pago — falta na chegada</option>
              <option value="mp_total">✅ 100% pago — quitado</option>
            </select>
          </div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Observações</label><textarea style={{...inp,resize:"vertical"}} rows={2} value={fObs} placeholder="Churrasqueira, sauna..." onChange={e=>setFObs(e.target.value)}/></div>
        <Switch on={fChurr} onChange={setFChurr} label="Churrasqueira"/>
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
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            <Badge t={modalD.st||"confirmado"}>{modalD.st}</Badge>
            <BadgePag pag={modalD.pag} val={modalD.val}/>
            {isParcial(modalD.pag)&&<Badge t="parcial">🏃 Cobrar R${((modalD.val||0)*0.5).toFixed(2)} na chegada</Badge>}
            {modalD.churr&&<Badge t="confirmado">🍖 Churrasqueira</Badge>}
          </div>
          {modalD.obs&&<div style={{background:"#f9fafb",padding:12,borderRadius:8,fontSize:13,marginBottom:16}}><strong>Obs:</strong> {modalD.obs}</div>}
          <Btn full onClick={()=>{setModalD(null);abrirEditAg(modalD);}}>✏️ Editar</Btn>
          <div style={{height:8}}/>
          <Btn full onClick={()=>setModalD(null)}>Fechar</Btn>
        </>}
      </Modal>

      {/* ── MODAL BLOQUEIO ── */}
      <Modal open={!!modalB} onClose={()=>setModalB(false)}>
        <div style={{fontWeight:800,fontSize:22,marginBottom:16}}>🔒 Bloquear Horário</div>
        <div style={{marginBottom:14}}><label style={lbl}>Quadra</label>
          <select style={inp} value={bQid} onChange={e=>setBQid(e.target.value)}>
            {qds.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Data</label><input type="date" style={inp} value={bData} onChange={e=>setBData(e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Início</label><input type="time" style={inp} value={bIni} onChange={e=>setBIni(e.target.value)}/></div>
          <div><label style={lbl}>Fim</label><input type="time" style={inp} value={bFim} onChange={e=>setBFim(e.target.value)}/></div>
        </div>
        <div style={{marginBottom:14}}><label style={lbl}>Motivo (opcional)</label><input style={inp} value={bMotivo} placeholder="Ex: Chuva, manutenção..." onChange={e=>setBMotivo(e.target.value)}/></div>
        <Btn c="v" full onClick={salvarBloqueio}>🔒 Bloquear Horário</Btn>
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
            <div style={{fontSize:12,color:"#6b7280",marginBottom:8}}>Faixas de preço:</div>
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

      <Toast msg={toast}/>
    </div>
  );
}
