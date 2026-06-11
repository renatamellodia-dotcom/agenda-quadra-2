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

function saldo(ag) {
  if(!ag) return 0;
  if(isPago(ag.pag)) return 0;
  if(["mp_50","pix_50","cartao_50","pago_50"].includes(ag.pag||"")) return (ag.val||0)*0.5;
  return ag.val||0;
}

function pagoPeloSite(ag) {
  if(!ag) return 0;
  const val = parseFloat(ag.val)||0;
  const pag = ag.pag||"";
  if(["mp_pix","mp_cartao","mp_total"].includes(pag)) return val;
  if(pag==="mp_50") return val*0.5;
  return 0;
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
  const [finalizados, setFinalizados] = useState([]);
  const [edicoes, setEdicoes] = useState({});
  const [recebidoHoje, setRecebidoHoje] = useState(0);
  const [recebidoMaquina, setRecebidoMaquina] = useState(0);
  const [recebidoDinheiro, setRecebidoDinheiro] = useState(0);
  const [alarme, setAlarme] = useState(null);

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

  // Alarme fim de jogo
  useEffect(()=>{
    if(!logado) return;
    const ds = dia;
    const agsDia = agendamentos.filter(a=>a.data===ds&&a.st==="confirmado"&&a.pag&&a.pag!=="");
    for(const ag of agsDia){
      const [fH,fM] = ag.fim.split(":").map(Number);
      const fimMs = new Date();
      fimMs.setHours(fH,fM,0,0);
      const diff = fimMs-hora;
      if(diff>0&&diff<60000&&!finalizados.includes(ag.id)){
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
    const agE = getAg(id);
    const total = saldo(agE);
    const isDinheiro = tipo==="mp_total_dinheiro";
    setEdicoes(p=>({...p,[id]:{...p[id],pag:tipo}}));
    setFinalizados(p=>[...p,id]);
    setRecebidoHoje(r=>r+total);
    if(isDinheiro) setRecebidoDinheiro(r=>r+total);
    else setRecebidoMaquina(r=>r+total);
    setModalPag(null);
    try { await updateDoc(doc(db,"agendamentos",id),{pag:tipo}); } catch(e){}
  }

  async function desfazerPag(id) {
    if(!window.confirm("Desfazer recebimento?")) return;
    const agE = getAg(id);
    const total = saldo(agE);
    const isDinheiro = agE.pag==="mp_total_dinheiro";
    setEdicoes(p=>({...p,[id]:{...p[id],pag:"pendente"}}));
    setFinalizados(p=>p.filter(x=>x!==id));
    setRecebidoHoje(r=>Math.max(0,r-total));
    if(isDinheiro) setRecebidoDinheiro(r=>Math.max(0,r-total));
    else setRecebidoMaquina(r=>Math.max(0,r-total));
    try { await updateDoc(doc(db,"agendamentos",id),{pag:"pendente"}); } catch(e){}
  }

  const ds = dia;
  const agsDia = agendamentos
    .filter(a=>a.data===ds&&a.st==="confirmado"&&a.pag&&a.pag!=="")
    .sort((a,b)=>a.ini.localeCompare(b.ini));

  const aCobrar = agsDia.filter(a=>{
    const ag = getAg(a.id);
    return !isPago(ag.pag)&&!finalizados.includes(a.id);
  }).reduce((s,a)=>{
    const ag = getAg(a.id);
    return s+saldo(ag)+(ag.sauna?15:0);
  },0);

  const saunaHoje = agsDia.filter(a=>getAg(a.id).sauna).length;

  // Navegar dias
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
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden"}}>
          {[
            {label:"💰 Recebido hoje",      val:`R$ ${recebidoHoje.toFixed(2)}`,    cor:"#86efac"},
            {label:"🟡 Falta receber hoje", val:`R$ ${aCobrar.toFixed(2)}`,          cor:"#fde68a"},
            {label:"💳 Recebido em máquina",val:`R$ ${recebidoMaquina.toFixed(2)}`,  cor:"white"},
            {label:"💵 Recebido em dinheiro",val:`R$ ${recebidoDinheiro.toFixed(2)}`,cor:"white"},
            {label:"🔥 Sauna prevista hoje", val:`${saunaHoje} reserva${saunaHoje!==1?"s":""}`, cor:saunaHoje>0?"#fde68a":"rgba(255,255,255,0.4)"},
          ].map(({label,val,cor},i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>{label}</span>
              <span style={{fontSize:14,fontWeight:800,color:cor}}>{val}</span>
            </div>
          ))}
        </div>
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
          const totalCobrar = saldo(agE)+(agE.sauna?15:0);
          const agoraMin = hora.getHours()*60+hora.getMinutes();
          const iniMin = parseInt(a.ini.split(":")[0])*60+parseInt(a.ini.split(":")[1]);
          const fimMin = parseInt(a.fim.split(":")[0])*60+parseInt(a.fim.split(":")[1]);
          const emAndamento = agoraMin>=iniMin&&agoraMin<fimMin;
          const qNome = agE.qid==="q2" ? "🏐 Quadra de Areia" : "⚽ Campo Society";
          const qCor = agE.qid==="q2" ? "#0891b2" : VE;

          return (
            <div key={a.id} style={{marginBottom:10,background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 3px 12px rgba(0,0,0,.08)"}}>
              <div style={{padding:"14px 16px"}}>
                {/* Selo modalidade */}
                <div style={{display:"inline-flex",alignItems:"center",gap:6,background:qCor,borderRadius:20,padding:"3px 12px",marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:"white"}}>{qNome}</span>
                </div>
                {/* Em andamento */}
                {emAndamento && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#16a34a",borderRadius:20,padding:"3px 12px",marginBottom:8,marginLeft:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:"white"}}>🟢 EM ANDAMENTO</span>
                  </div>
                )}
                {/* Nome */}
                <div style={{fontWeight:800,fontSize:17,color:"#1a1f2e",textTransform:"uppercase",marginBottom:4}}>
                  {agE.cli||a.cli}
                </div>
                {/* Telefone */}
                {(agE.tel||a.tel) && (
                  <div style={{fontSize:13,color:"#6b7280",marginBottom:6}}>📞 {agE.tel||a.tel}</div>
                )}
                {/* Horário */}
                <div style={{fontSize:14,color:"#6b7280",marginBottom:10}}>
                  ⏰ <span style={{fontWeight:600}}>{a.ini} às {a.fim}</span>
                </div>
                {/* Pessoas e Sauna */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#f3f4f6",padding:"4px 10px",borderRadius:20}}>
                    👥 {agE.pess||a.pess||"?"} pessoas
                  </span>
                  <span style={{fontSize:13,fontWeight:700,
                    color:agE.sauna?"#065f46":"#9ca3af",
                    background:agE.sauna?"#dcfce7":"#f9fafb",
                    padding:"4px 10px",borderRadius:20}}>
                    🧖 Sauna: {agE.sauna?"Sim ✅":"Não"}
                  </span>
                </div>
                {/* Observação */}
                {(agE.obs||a.obs) && (
                  <div style={{background:"#fef9c3",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#92400e",marginBottom:8}}>
                    📝 {agE.obs||a.obs}
                  </div>
                )}
                {/* Breakdown financeiro */}
                <div style={{background:"#f9fafb",borderRadius:10,overflow:"hidden",fontSize:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                    <span style={{color:"#6b7280"}}>Valor total</span>
                    <span style={{fontWeight:700,color:"#1a1f2e"}}>R$ {(agE.val||0).toFixed(2)}</span>
                  </div>
                  {pagoPeloSite(agE)>0 && (
                    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                      <span style={{color:"#6b7280"}}>Pago online</span>
                      <span style={{fontWeight:700,color:"#2E7D6B"}}>R$ {pagoPeloSite(agE).toFixed(2)}</span>
                    </div>
                  )}
                  {agE.sauna && (
                    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderBottom:"1px solid #e0e3e8"}}>
                      <span style={{color:"#6b7280"}}>Sauna</span>
                      <span style={{fontWeight:700,color:"#374151"}}>R$ 15,00</span>
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:totalCobrar>0?"#f0fdf4":"#f9fafb"}}>
                    <span style={{fontWeight:700,color:"#374151"}}>Falta receber</span>
                    <span style={{fontWeight:800,fontSize:15,color:totalCobrar>0?"#16a34a":"#9ca3af"}}>
                      {totalCobrar>0 ? `R$ ${totalCobrar.toFixed(2)}` : "✅ Quitado"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão de ação */}
              {isPagoOnline(agE.pag) && totalCobrar===0 ? (
                <div style={{padding:"12px 16px",background:"#eff6ff",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🔒</span>
                  <span style={{fontWeight:700,color:"#1e40af",fontSize:13}}>Pago online — não pode ser desfeito</span>
                </div>
              ) : totalCobrar>0 ? (
                <button onClick={()=>setModalPag(a.id)}
                  style={{width:"100%",padding:16,background:"#16a34a",color:"white",border:"none",fontSize:18,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>💰 COBRAR</span>
                  <span style={{fontSize:22,fontWeight:900}}>R$ {totalCobrar.toFixed(2)}</span>
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
              Registrar recebimento de <strong>R$ {saldo(getAg(modalPag)).toFixed(2)}</strong>
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
