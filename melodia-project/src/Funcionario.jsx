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
const SENHA = "melodia@shay";
const SAUNA_UNIT = 15;

function hoje() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function toDS(d) {
  return d.toISOString().split("T")[0];
}

function isPagoOnline(pag) {
  return ["mp_pix","mp_cartao","mp_total","mp_50"].includes(pag||"");
}

function isPagoPresencial(pag) {
  return ["mp_total_pix","mp_total_cartao","mp_total_dinheiro"].includes(pag||"");
}

function isPago(pag) {
  return ["mp_total","mp_total_pix","mp_total_cartao","mp_total_dinheiro",
    "pix_total","cartao_total","pago_total","dinheiro","mp_pix","mp_cartao"].includes(pag||"");
}

function saldoQuadra(ag) {
  if(!ag) return 0;
  const val = parseFloat(ag.val)||0;
  const pag = ag.pag||"";
  if(isPago(pag)) return 0;
  if(["mp_50","pix_50","cartao_50","pago_50"].includes(pag)) return val*0.5;
  return val;
}

function pagoPeloSite(ag) {
  if(!ag) return 0;
  const val = parseFloat(ag.val)||0;
  const pag = ag.pag||"";
  if(["mp_pix","mp_cartao","mp_total"].includes(pag)) return val;
  if(pag==="mp_50") return val*0.5;
  return 0;
}

function valorSauna(ag) {
  const qtd = parseInt(ag?.saunaQtd)||0;
  if(qtd <= 0) return 0;
  return qtd * SAUNA_UNIT;
}

function valorExcedente(ag, pessPresentes) {
  if(!ag || ag.qid!=="q2") return 0;
  const agendadas = parseInt(ag.pess)||0;
  const presentes = parseInt(pessPresentes)||agendadas;
  if(presentes <= agendadas || agendadas <= 0) return 0;
  const excedentes = presentes - agendadas;
  if(!ag.ini||!ag.fim) return 0;
  const [ih,im] = ag.ini.split(":").map(Number);
  const [fh,fm] = ag.fim.split(":").map(Number);
  const minutos = (fh*60+fm)-(ih*60+im);
  const horas = Math.floor(minutos/60);
  if(horas < 1) return 0; // menos de 1h não cobra excedente
  return excedentes * 10 * horas;
}

function totalCobrar(ag) {
  return saldoQuadra(ag) + valorSauna(ag) + valorExcedente(ag);
}

function Login({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  function tentar() {
    if(senha===SENHA) { onLogin(); }
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

  // Totais do dia (contabilizam pagamentos online + presenciais)
  const [recebidoHoje, setRecebidoHoje] = useState(0);
  const [recebidoMaquina, setRecebidoMaquina] = useState(0);
  const [recebidoDinheiro, setRecebidoDinheiro] = useState(0);
  const [recebidoSociety, setRecebidoSociety] = useState(0);
  const [recebidoAreia, setRecebidoAreia] = useState(0);
  const [recebidoSaunaTotal, setRecebidoSaunaTotal] = useState(0);

  useEffect(()=>{
    if(!logado) return;
    try {
      const unsub = onSnapshot(
        query(collection(db,"agendamentos"), where("st","!=","cancelado")),
        snap=>{ setAgendamentos(snap.docs.map(d=>({id:d.id,...d.data()}))); }
      );
      return ()=>unsub();
    } catch(e) { console.log("Firebase offline",e); }
  },[logado]);

  useEffect(()=>{
    const t = setInterval(()=>setHora(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  // Recalcular totais sempre que agendamentos ou edicoes mudarem
  useEffect(()=>{
    if(!logado) return;
    const ds = dia;
    const agsDia = agendamentos.filter(a=>a.data===ds&&a.st==="confirmado");
    
    let rHoje=0, rMaq=0, rDin=0, rSoc=0, rAr=0, rSauna=0;

    agsDia.forEach(a=>{
      const agE = {...a,...(edicoes[a.id]||{})};
      const val = parseFloat(agE.val)||0;
      const pag = agE.pag||"";
      const isSociety = agE.qid==="q1";
      const saunaVal = valorSauna(agE);

      // Pagamento online (já recebido)
      if(["mp_pix","mp_cartao","mp_total"].includes(pag)) {
        rHoje += val + saunaVal;
        if(isSociety) rSoc += val; else rAr += val;
        rSauna += saunaVal;
      } else if(pag==="mp_50") {
        rHoje += val*0.5 + saunaVal;
        if(isSociety) rSoc += val*0.5; else rAr += val*0.5;
        rSauna += saunaVal;
      }
      // Pagamento presencial
      else if(pag==="mp_total_cartao") {
        rHoje += val + saunaVal;
        rMaq += val + saunaVal;
        if(isSociety) rSoc += val; else rAr += val;
        rSauna += saunaVal;
      } else if(pag==="mp_total_dinheiro") {
        rHoje += val + saunaVal;
        rDin += val + saunaVal;
        if(isSociety) rSoc += val; else rAr += val;
        rSauna += saunaVal;
      }
    });

    setRecebidoHoje(rHoje);
    setRecebidoMaquina(rMaq);
    setRecebidoDinheiro(rDin);
    setRecebidoSociety(rSoc);
    setRecebidoAreia(rAr);
    setRecebidoSaunaTotal(rSauna);
  },[agendamentos, edicoes, dia, logado]);

  // Alarme fim de jogo
  useEffect(()=>{
    if(!logado) return;
    const ds = dia;
    const agsDia = agendamentos.filter(a=>a.data===ds&&a.st==="confirmado");
    for(const ag of agsDia){
      if(!ag.fim) continue;
      const [fH,fM] = ag.fim.split(":").map(Number);
      const fimMs = new Date();
      fimMs.setHours(fH,fM,0,0);
      const diff = fimMs-hora;
      if(diff>0&&diff<60000){
        setAlarme(ag);
      }
    }
  },[hora,agendamentos,dia,logado]);

  if(!logado) return <Login onLogin={()=>{sessionStorage.setItem("func_auth","1");setLogado(true);}}/>;

  function getAg(id){
    const ag = agendamentos.find(x=>x.id===id);
    return {...ag,...(edicoes[id]||{})};
  }

  async function confirmarPag(id, tipo) {
    setEdicoes(p=>({...p,[id]:{...p[id],pag:tipo}}));
    setModalPag(null);
    try { await updateDoc(doc(db,"agendamentos",id),{pag:tipo}); } catch(e){}
  }

  async function desfazerPag(id) {
    if(!window.confirm("Desfazer recebimento?")) return;
    setEdicoes(p=>({...p,[id]:{...p[id],pag:"pendente"}}));
    try { await updateDoc(doc(db,"agendamentos",id),{pag:"pendente"}); } catch(e){}
  }

  async function salvarSaunaQtd(id, qtd) {
    setEdicoes(p=>({...p,[id]:{...p[id],saunaQtd:qtd}}));
    try { await updateDoc(doc(db,"agendamentos",id),{saunaQtd:qtd}); } catch(e){}
  }

  async function salvarPessPresentes(id, qtd) {
    const val = Math.max(0, qtd);
    setEdicoes(p=>({...p,[id]:{...p[id],pessPresentes:val}}));
    try { await updateDoc(doc(db,"agendamentos",id),{pessPresentes:val}); } catch(e){}
  }

  function getPessPresentes(ag) {
    // Se já foi editado, usa o valor editado; senão usa o agendado
    if(edicoes[ag.id]?.pessPresentes !== undefined) return parseInt(edicoes[ag.id].pessPresentes)||0;
    if(ag.pessPresentes !== undefined) return parseInt(ag.pessPresentes)||0;
    return parseInt(ag.pess)||0; // valor inicial = agendado
  }

  const ds = dia;
  const agsDia = agendamentos
    .filter(a=>a.data===ds&&a.st==="confirmado")
    .sort((a,b)=>a.ini.localeCompare(b.ini));

  const aCobrar = agsDia.reduce((s,a)=>{
    const agE = getAg(a.id);
    return s + totalCobrar(agE);
  },0);

  const saunaHoje = agsDia.filter(a=>getAg(a.id).sauna);
  
  // Próxima sauna
  const agoraMin = hora.getHours()*60+hora.getMinutes();
  const proximaSauna = saunaHoje.find(a=>{
    const agE = getAg(a.id);
    if(!agE.ini) return false;
    const [h,m] = agE.ini.split(":").map(Number);
    return h*60+m >= agoraMin;
  });

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
        <div style={{color:"white",fontWeight:700,fontSize:14,textTransform:"capitalize"}}>
          {nomeDia(dia)}
        </div>
        <button onClick={()=>mudarDia(1)}
          style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",width:36,height:36,borderRadius:8,fontSize:20,cursor:"pointer"}}>›</button>
      </div>

      {/* PAINEL SUPERIOR */}
      <div style={{background:VE,padding:"0 16px 14px"}}>

        {/* DESTAQUE: Falta receber no balcão */}
        <div style={{background:"rgba(253,230,138,0.15)",border:"2px solid #fde68a",borderRadius:14,padding:"16px",marginBottom:10,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fde68a",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>💰 FALTA RECEBER NO BALCÃO</div>
          <div style={{fontWeight:900,fontSize:34,color:"#fde68a"}}>{`R$ ${aCobrar.toFixed(2)}`}</div>
        </div>

        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden"}}>
          {[
            {label:"💳 Recebido em máquina",     val:`R$ ${recebidoMaquina.toFixed(2)}`,     cor:"white"},
            {label:"💵 Recebido em dinheiro",    val:`R$ ${recebidoDinheiro.toFixed(2)}`,    cor:"white"},
            {label:"⚽ Recebido Society",         val:`R$ ${recebidoSociety.toFixed(2)}`,     cor:"rgba(255,255,255,0.7)"},
            {label:"🏐 Recebido Areia",           val:`R$ ${recebidoAreia.toFixed(2)}`,       cor:"rgba(255,255,255,0.7)"},
            {label:"🧖 Recebido Sauna",           val:`R$ ${recebidoSaunaTotal.toFixed(2)}`,  cor:"rgba(255,255,255,0.7)"},
            {label:"🔥 Saunas previstas hoje",    val:`${saunaHoje.length} reserva${saunaHoje.length!==1?"s":""}`, cor:saunaHoje.length>0?"#fde68a":"rgba(255,255,255,0.4)"},
          ].map(({label,val,cor},i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>{label}</span>
              <span style={{fontSize:14,fontWeight:800,color:cor}}>{val}</span>
            </div>
          ))}
        </div>

        {/* PRÓXIMA SAUNA */}
        {proximaSauna && (
          <div style={{background:"rgba(255,220,100,0.15)",border:"1px solid rgba(255,220,100,0.3)",borderRadius:10,padding:"10px 14px",marginTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#fde68a",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🔥 Próxima Sauna</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:800,color:"white",fontSize:15}}>{proximaSauna.ini}</div>
                <div style={{color:"rgba(255,255,255,0.7)",fontSize:13}}>{proximaSauna.cli}</div>
              </div>
              <div style={{color:"#fde68a",fontWeight:700,fontSize:14}}>
                {parseInt(getAg(proximaSauna.id).saunaQtd)||"?"} pessoas
              </div>
            </div>
          </div>
        )}
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
          const ppCard = getPessPresentes(agE);
          const cobrar = saldoQuadra(agE) + valorSauna(agE) + valorExcedente(agE, ppCard);
          const agoraMin = hora.getHours()*60+hora.getMinutes();
          const iniMin = parseInt(a.ini.split(":")[0])*60+parseInt(a.ini.split(":")[1]);
          const fimMin = parseInt(a.fim.split(":")[0])*60+parseInt(a.fim.split(":")[1]);
          const emAndamento = agoraMin>=iniMin&&agoraMin<fimMin;
          const qNome = agE.qid==="q2" ? "🏐 Quadra de Areia" : "⚽ Campo Society";
          const qCor = agE.qid==="q2" ? "#0891b2" : VE;
          const saunaQtd = parseInt(agE.saunaQtd)||0;
          const saunaVal = valorSauna(agE);
          const quadraVal = parseFloat(agE.val)||0;
          const pagoSite = pagoPeloSite(agE);
          const saldoQ = saldoQuadra(agE);

          return (
            <div key={a.id} style={{marginBottom:10,background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 3px 12px rgba(0,0,0,.08)"}}>
              <div style={{padding:"14px 16px"}}>

                {/* Selo modalidade + EM ANDAMENTO */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,background:qCor,borderRadius:20,padding:"3px 12px"}}>
                    <span style={{fontSize:12,fontWeight:700,color:"white"}}>{qNome}</span>
                  </div>
                  {emAndamento && (
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#16a34a",borderRadius:20,padding:"3px 12px"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"white"}}>🟢 EM ANDAMENTO</span>
                    </div>
                  )}
                </div>

                {/* Nome */}
                <div style={{fontWeight:800,fontSize:17,color:"#1a1f2e",textTransform:"uppercase",marginBottom:4}}>
                  {agE.cli||a.cli}
                </div>

                {/* Telefone clicável */}
                {(agE.tel||a.tel) && (
                  <a href={`https://wa.me/55${(agE.tel||a.tel).replace(/\D/g,"")}`} target="_blank"
                    style={{display:"block",fontSize:13,color:"#16a34a",marginBottom:6,textDecoration:"none",fontWeight:600}}>
                    📞 {agE.tel||a.tel} 💬
                  </a>
                )}

                {/* Horário */}
                <div style={{fontSize:14,color:"#6b7280",marginBottom:10}}>
                  ⏰ <span style={{fontWeight:600}}>{a.ini} às {a.fim}</span>
                </div>

                {/* Pessoas agendadas + excedentes (Areia) */}
                <div style={{marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#f3f4f6",padding:"4px 10px",borderRadius:20}}>
                    👥 {agE.pess||a.pess||"?"} pessoas agendadas
                  </span>
                </div>
                {agE.qid==="q2" && (()=>{
                  const pp = getPessPresentes(agE);
                  const agendadas = parseInt(agE.pess)||0;
                  const excVal = valorExcedente(agE, pp);
                  const excQtd = pp - agendadas;
                  return (
                    <div style={{background:"#f0f9ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"12px",marginBottom:10}}>
                      <div style={{fontWeight:700,color:"#1e40af",fontSize:13,marginBottom:4}}>👥 Total de pessoas na área exclusiva</div>
                      <div style={{fontSize:11,color:"#6b7280",marginBottom:10}}>(quadra, deck e churrasqueira)</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <button onClick={()=>salvarPessPresentes(a.id, pp-1)}
                          style={{width:36,height:36,borderRadius:8,border:"1.5px solid #1e40af",background:"white",color:"#1e40af",fontWeight:800,fontSize:22,cursor:"pointer",lineHeight:1}}>−</button>
                        <span style={{fontWeight:900,fontSize:28,color:"#1e40af",minWidth:36,textAlign:"center"}}>{pp}</span>
                        <button onClick={()=>salvarPessPresentes(a.id, pp+1)}
                          style={{width:36,height:36,borderRadius:8,border:"1.5px solid #1e40af",background:"#1e40af",color:"white",fontWeight:800,fontSize:22,cursor:"pointer",lineHeight:1}}>+</button>
                        {excQtd>0 && (
                          <span style={{fontSize:13,fontWeight:700,color:"#dc2626",background:"#fee2e2",padding:"4px 10px",borderRadius:20}}>
                            +{excQtd} excedente{excQtd>1?"s":""} = R$ {excVal.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Sauna */}
                <div style={{background:(agE.sauna&&saunaQtd>0)?"#f0fdf4":"#f9fafb",border:`1px solid ${(agE.sauna&&saunaQtd>0)?"#bbf7d0":"#e0e3e8"}`,borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                  <div style={{fontWeight:700,color:"#374151",fontSize:13,marginBottom:8}}>🧖 Sauna</div>
                  <div style={{display:"flex",gap:10,marginBottom:8}}>
                    {[["Não",0],["Sim",saunaQtd>0?saunaQtd:1]].map(([label,val])=>(
                      <button key={label} onClick={()=>salvarSaunaQtd(a.id, label==="Não"?0:(saunaQtd>0?saunaQtd:1))}
                        style={{flex:1,padding:"7px",borderRadius:8,border:`1.5px solid ${(label==="Não"&&saunaQtd===0)||(label==="Sim"&&saunaQtd>0)?"#16a34a":"#e0e3e8"}`,background:(label==="Não"&&saunaQtd===0)||(label==="Sim"&&saunaQtd>0)?"#16a34a":"white",color:(label==="Não"&&saunaQtd===0)||(label==="Sim"&&saunaQtd>0)?"white":"#374151",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        {label==="Não"?"☐ Não":"☑ Sim"}
                      </button>
                    ))}
                  </div>
                  {saunaQtd>0 && (
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:13,color:"#374151"}}>Pessoas na sauna:</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={()=>salvarSaunaQtd(a.id, Math.max(1, saunaQtd-1))}
                          style={{width:30,height:30,borderRadius:8,border:"1.5px solid #16a34a",background:"white",color:"#16a34a",fontWeight:800,fontSize:18,cursor:"pointer",lineHeight:1}}>−</button>
                        <span style={{fontWeight:800,fontSize:18,color:VE,minWidth:24,textAlign:"center"}}>{saunaQtd}</span>
                        <button onClick={()=>salvarSaunaQtd(a.id, saunaQtd+1)}
                          style={{width:30,height:30,borderRadius:8,border:"1.5px solid #16a34a",background:"#16a34a",color:"white",fontWeight:800,fontSize:18,cursor:"pointer",lineHeight:1}}>+</button>
                        <span style={{fontSize:13,fontWeight:700,color:"#065f46"}}>= R$ {saunaVal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Observação */}
                {(agE.obs||a.obs) && (
                  <div style={{background:"#fef9c3",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#92400e",marginBottom:8}}>
                    📝 {agE.obs||a.obs}
                  </div>
                )}

                {/* Breakdown financeiro detalhado */}
                {(()=>{
                  const ppLocal = getPessPresentes(agE);
                  const excVal = valorExcedente(agE, ppLocal);
                  const excQtdLocal = ppLocal - (parseInt(agE.pess)||0);
                  const totalVal = quadraVal + excVal + saunaVal;
                  return (
                    <div style={{background:"#f9fafb",borderRadius:10,overflow:"hidden",fontSize:13}}>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                        <span style={{color:"#6b7280"}}>Valor da quadra</span>
                        <span style={{fontWeight:700,color:"#1a1f2e"}}>R$ {quadraVal.toFixed(2)}</span>
                      </div>
                      {excVal>0 && (
                        <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                          <span style={{color:"#dc2626"}}>Excedentes (+{excQtdLocal} pessoas)</span>
                          <span style={{fontWeight:700,color:"#dc2626"}}>R$ {excVal.toFixed(2)}</span>
                        </div>
                      )}
                      {saunaVal>0 && (
                        <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                          <span style={{color:"#6b7280"}}>Sauna ({saunaQtd}×R${SAUNA_UNIT})</span>
                          <span style={{fontWeight:700,color:"#065f46"}}>R$ {saunaVal.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8",background:"#f3f4f6"}}>
                        <span style={{fontWeight:700,color:"#374151"}}>Valor total</span>
                        <span style={{fontWeight:800,color:"#1a1f2e"}}>R$ {totalVal.toFixed(2)}</span>
                      </div>
                      {pagoSite>0 && (
                        <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                          <span style={{color:"#6b7280"}}>Pago online</span>
                          <span style={{fontWeight:700,color:"#2E7D6B"}}>R$ {pagoSite.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:cobrar>0?"#fff7ed":"#f9fafb"}}>
                        <span style={{fontWeight:700,color:"#374151"}}>Falta receber no balcão</span>
                        <span style={{fontWeight:800,fontSize:15,color:cobrar>0?"#ea580c":"#9ca3af"}}>
                          {cobrar>0 ? `R$ ${cobrar.toFixed(2)}` : "✅ Quitado"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Botão de ação */}
              {isPagoOnline(agE.pag) && cobrar===0 ? (
                <div style={{padding:"12px 16px",background:"#eff6ff",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🔒</span>
                  <span style={{fontWeight:700,color:"#1e40af",fontSize:13}}>Pago online — não pode ser desfeito</span>
                </div>
              ) : cobrar>0 ? (
                <button onClick={()=>setModalPag(a.id)}
                  style={{width:"100%",padding:16,background:"#16a34a",color:"white",border:"none",fontSize:18,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>💰 COBRAR</span>
                  <span style={{fontSize:22,fontWeight:900}}>R$ {cobrar.toFixed(2)}</span>
                </button>
              ) : isPagoPresencial(agE.pag) ? (
                <div style={{padding:"12px 16px",background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
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
                <div style={{padding:"12px 16px",background:"#f0fdf4",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:700,color:"#16a34a",fontSize:13}}>✅ Pago pelo site — aguardando chegada</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL PAGAMENTO */}
      {modalPag && (
        <div onClick={()=>setModalPag(null)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"white",borderRadius:20,width:"100%",maxWidth:420,padding:"28px 20px 24px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{width:40,height:4,background:"#e0e3e8",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontWeight:800,fontSize:20,marginBottom:6,color:"#1a1f2e"}}>Como o cliente pagou?</div>
            <div style={{fontSize:14,color:"#6b7280",marginBottom:20}}>
              Registrar recebimento de <strong>R$ {totalCobrar(getAg(modalPag)).toFixed(2)}</strong>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[["💳","Máquina","mp_total_cartao"],["💵","Dinheiro","mp_total_dinheiro"]].map(([ic,label,tipo])=>(
                <button key={tipo} onClick={()=>confirmarPag(modalPag,tipo)}
                  style={{padding:"18px 8px",background:"#f9fafb",border:"2px solid #e0e3e8",borderRadius:12,cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:28}}>{ic}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#1a1f2e",marginTop:8}}>{label}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setModalPag(null)}
              style={{width:"100%",padding:"13px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
