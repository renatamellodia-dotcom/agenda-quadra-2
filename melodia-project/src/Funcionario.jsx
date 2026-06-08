import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";

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

const V="#2E7D6B",VE="#1a5248",LA="#E8861A",VM="#e53e3e",AM="#854d0e";

const AGS = [
  {id:"1",qid:"q1",qnm:"Quadra Society",data:"2026-06-04",ini:"08:00",fim:"09:00",cli:"Carlos Mendes",tel:"(22) 99801-1234",tp:"avulso",st:"confirmado",pag:"mp_total",val:130,pess:null,sauna:false,churr:false},
  {id:"2",qid:"q2",qnm:"Quadra Areia",data:"2026-06-04",ini:"09:00",fim:"10:00",cli:"Fernanda Lima",tel:"(22) 99802-5678",tp:"mensalista",st:"confirmado",pag:"mp_50",val:70,pess:10,sauna:true,churr:false},
  {id:"3",qid:"q1",qnm:"Quadra Society",data:"2026-06-04",ini:"10:00",fim:"11:00",cli:"Ricardo Souza",tel:"(22) 99803-9012",tp:"avulso",st:"confirmado",pag:"pendente",val:130,pess:null,sauna:false,churr:false},
  {id:"4",qid:"q2",qnm:"Quadra Areia",data:"2026-06-04",ini:"11:00",fim:"12:00",cli:"Ana Paula Costa",tel:"(22) 99804-3456",tp:"avulso",st:"confirmado",pag:"mp_50",val:80,pess:13,sauna:false,churr:true},
  {id:"5",qid:"q1",qnm:"Quadra Society",data:"2026-06-04",ini:"14:00",fim:"15:00",cli:"Marcos Oliveira",tel:"(22) 99805-7890",tp:"avulso",st:"confirmado",pag:"mp_total",val:130,pess:null,sauna:false,churr:false},
  {id:"6",qid:"q2",qnm:"Quadra Areia",data:"2026-06-04",ini:"16:00",fim:"17:00",cli:"Juliana Santos",tel:"(22) 99806-2345",tp:"avulso",st:"confirmado",pag:"mp_total_pix",val:60,pess:7,sauna:true,churr:false},
  {id:"7",qid:"q1",qnm:"Quadra Society",data:"2026-06-04",ini:"19:00",fim:"20:00",cli:"Bruno Almeida",tel:"(22) 99807-6789",tp:"mensalista",st:"confirmado",pag:"pendente",val:130,pess:null,sauna:false,churr:false},
  {id:"8",qid:"q2",qnm:"Quadra Areia",data:"2026-06-04",ini:"20:00",fim:"21:00",cli:"Patrícia Rocha",tel:"(22) 99808-0123",tp:"avulso",st:"confirmado",pag:"mp_50",val:70,pess:9,sauna:false,churr:false},
];

function hoje(){const d=new Date();d.setHours(0,0,0,0);return d;}
function toDS(d){return d.toISOString().split("T")[0];}
function nomeDia(d){
  const hj=hoje();
  if(toDS(d)===toDS(hj))return"Hoje";
  const am=new Date(hj);am.setDate(am.getDate()+1);
  if(toDS(d)===toDS(am))return"Amanhã";
  return d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
}

function isPago(p){return["mp_total","mp_total_pix","mp_total_cartao","mp_total_dinheiro","pix_total","cartao_total","pago_total","dinheiro"].includes(p);}
function isParcial(p){return["mp_50","pix_50","cartao_50","pago_50"].includes(p);}
function saldo(ag){if(isPago(ag.pag))return 0;if(isParcial(ag.pag))return(ag.val||0)*0.5;return ag.val||0;}
function labelPag(p){
  if(p==="mp_total_pix") return "✅ Pago — Pix";
  if(p==="mp_total_cartao") return "✅ Pago — Cartão";
  if(p==="mp_total_dinheiro") return "✅ Pago — Dinheiro";
  if(isPago(p)) return "✅ Pago";
  if(isParcial(p)) return "💛 50% pago";
  return "⏳ Não pago";
}
function calcAreia(n){if(!n||n<=0)return 0;if(n<=8)return 60;if(n<=12)return 70;return 70+(n-12)*10;}

function tocarSom(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [[440,0],[550,0.25],[660,0.5],[660,1.0],[550,1.25],[440,1.5]].forEach(([f,t])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=f;o.type="sine";
      g.gain.setValueAtTime(0.4,ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.3);
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.4);
    });
  }catch(e){}
}

export default function App(){
  const [dia,setDia]=useState(hoje());
  const [showCal,setShowCal]=useState(false);
  const [aberto,setAberto]=useState(null);
  const [finalizados,setFinalizados]=useState([]);
  const [edicoes,setEdicoes]=useState({});
  const [alarme,setAlarme]=useState(null);
  const [hora,setHora]=useState(new Date());
  const [editPess,setEditPess]=useState(false);
  const [novaPess,setNovaPess]=useState("");
  const [modalPag,setModalPag]=useState(null);
  const [agendamentos,setAgendamentos]=useState([]);

  // Carrega agendamentos do Firebase em tempo real
  useEffect(()=>{
    try {
      const unsub = onSnapshot(
        query(collection(db,"agendamentos"), where("st","!=","cancelado")),
        snap=>{ setAgendamentos(snap.docs.map(d=>({id:d.id,...d.data()}))); }
      );
      return ()=>unsub();
    } catch(e){ console.log("Firebase offline",e); }
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>setHora(new Date()),30000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const ds=toDS(dia);
    const hh=hora.getHours().toString().padStart(2,"0");
    const mm=hora.getMinutes().toString().padStart(2,"0");
    const agoraMin=parseInt(hh)*60+parseInt(mm);
    const agsDia=agendamentos.filter(a=>a.data===ds&&a.st!=="cancelado"&&a.st!=="aguardando_pagamento"&&!finalizados.includes(a.id));
    for(const ag of agsDia){
      const[fH,fM]=ag.fim.split(":").map(Number);
      if(fH*60+fM===agoraMin&&!alarme){tocarSom();setAlarme(ag);break;}
    }
  },[hora,dia,finalizados]);

  const ds=toDS(dia);
  const agsDia=agendamentos.filter(a=>a.data===ds&&a.st!=="cancelado"&&a.st!=="aguardando_pagamento").sort((a,b)=>a.ini.localeCompare(b.ini));

  function getAg(id){
    const ag=agendamentos.find(x=>x.id===id);
    return{...ag,...(edicoes[id]||{})};
  }

  async function confirmarPessoas(id){
    const n=parseInt(novaPess);if(!n||n<1)return;
    const novoVal=calcAreia(n);
    setEdicoes(p=>({...p,[id]:{...p[id],pess:n,val:novoVal}}));
    setEditPess(false);setNovaPess("");
    tocarSom();
    try{ await updateDoc(doc(db,"agendamentos",id),{pess:n,val:novoVal}); }catch(e){}
  }

  function marcarRecebido(id){
    setModalPag(id);
  }

  async function confirmarFormaPag(id,tipo){
    setEdicoes(p=>({...p,[id]:{...p[id],pag:tipo}}));
    setModalPag(null);
    tocarSom();
    try{ await updateDoc(doc(db,"agendamentos",id),{pag:tipo}); }catch(e){}
  }

  const ag=aberto?getAg(aberto):null;
  const salAg=ag?saldo(ag):0;
  const isAreia=ag?.qid==="q2";

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:"#f0f4f8",minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>

      {/* ALARME */}
      {alarme&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"white",borderRadius:24,padding:32,textAlign:"center",width:"100%",maxWidth:360}}>
            <div style={{fontSize:64,marginBottom:8}}>⏰</div>
            <div style={{fontWeight:800,fontSize:28,color:VM,marginBottom:8}}>FIM DO JOGO!</div>
            <div style={{fontSize:18,fontWeight:700,color:"#1a1f2e",marginBottom:4}}>{alarme.qnm}</div>
            <div style={{fontSize:16,color:"#6b7280",marginBottom:4}}>{alarme.cli}</div>
            <div style={{fontSize:16,color:"#6b7280",marginBottom:24}}>{alarme.ini} → {alarme.fim}</div>
            {saldo(alarme)>0&&(
              <div style={{background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:12,padding:14,marginBottom:20}}>
                <div style={{fontSize:14,color:VM,fontWeight:700}}>💰 COBRAR NA SAÍDA</div>
                <div style={{fontSize:32,fontWeight:800,color:VM}}>R$ {saldo(alarme).toFixed(2)}</div>
              </div>
            )}
            <button onClick={()=>{setFinalizados(p=>[...p,alarme.id]);setAlarme(null);}}
              style={{width:"100%",padding:"18px",background:V,color:"white",border:"none",borderRadius:16,fontSize:20,fontWeight:800,cursor:"pointer"}}>
              ✓ ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* MINI MODAL — FORMA DE PAGAMENTO */}
      {modalPag&&(
        <div onClick={()=>setModalPag(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:"24px 20px 40px"}}>
            <div style={{width:40,height:4,background:"#e0e3e8",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontWeight:800,fontSize:20,marginBottom:6,color:"#1a1f2e"}}>Como o cliente pagou?</div>
            <div style={{fontSize:14,color:"#6b7280",marginBottom:20}}>R$ {saldo(getAg(modalPag)).toFixed(2)} recebido</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
              {[["📱","Pix","mp_total_pix"],["💳","Cartão","mp_total_cartao"],["💵","Dinheiro","mp_total_dinheiro"]].map(([ic,label,tipo])=>(
                <button key={tipo} onClick={()=>confirmarFormaPag(modalPag,tipo)}
                  style={{padding:"18px 8px",background:"#f9fafb",border:"2px solid #e0e3e8",borderRadius:12,cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:28}}>{ic}</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#1a1f2e",marginTop:8}}>{label}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setModalPag(null)} style={{width:"100%",padding:"13px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:VE,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontWeight:800,fontSize:20,color:"white"}}>⚽ MELODIA</div>
        <div style={{color:"rgba(255,255,255,0.8)",fontSize:14,fontWeight:600}}>
          {hora.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>

      {/* CALENDÁRIO MODAL */}
      {showCal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"white",borderRadius:20,padding:20,width:"100%",maxWidth:360}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:18,color:"#1a1f2e"}}>Escolher data</div>
              <button onClick={()=>setShowCal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            <input type="date" defaultValue={toDS(dia)}
              onChange={e=>{
                if(e.target.value){
                  const [y,m,d]=e.target.value.split("-").map(Number);
                  const nd=new Date(y,m-1,d);
                  setDia(nd);
                  setShowCal(false);
                }
              }}
              style={{width:"100%",padding:"14px",border:"1.5px solid #e0e3e8",borderRadius:12,fontSize:16,outline:"none",color:"#1a1f2e"}}
            />
            <button onClick={()=>{setDia(hoje());setShowCal(false);}} style={{width:"100%",marginTop:12,padding:"12px",background:"#2E7D6B",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer"}}>
              📅 Ir para Hoje
            </button>
          </div>
        </div>
      )}

      {/* SELETOR DE DIA */}
      <div style={{background:V,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setDia(d=>{const n=new Date(d);n.setDate(n.getDate()-1);return n;})}
          style={{width:40,height:40,borderRadius:10,border:"none",background:"rgba(255,255,255,0.2)",color:"white",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:22,color:"white",textTransform:"capitalize"}}>{nomeDia(dia)}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",cursor:"pointer"}} onClick={()=>setShowCal(true)}>
            📅 {dia.toLocaleDateString("pt-BR",{day:"numeric",month:"long"})} · {agsDia.length} reserva{agsDia.length!==1?"s":""}
          </div>
        </div>
        <button onClick={()=>setDia(d=>{const n=new Date(d);n.setDate(n.getDate()+1);return n;})}
          style={{width:40,height:40,borderRadius:10,border:"none",background:"rgba(255,255,255,0.2)",color:"white",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {/* STATS — total a receber */}
      {agsDia.length>0&&(()=>{
        const aCobrar=agsDia.reduce((s,a)=>s+saldo(getAg(a.id)),0);
        return(
          <div style={{background:VE,padding:"0 16px 14px"}}>
            {aCobrar>0?(
              <div style={{background:"rgba(234,179,8,0.2)",border:"1px solid rgba(234,179,8,0.4)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:600}}>💰 TOTAL A RECEBER HOJE</div>
                  <div style={{fontWeight:800,fontSize:26,color:"#fde68a",marginTop:2}}>R$ {aCobrar.toFixed(2)}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",textAlign:"right"}}>
                  {agsDia.filter(a=>saldo(getAg(a.id))>0).length} reserva{agsDia.filter(a=>saldo(getAg(a.id))>0).length!==1?"s":""}<br/>pendentes
                </div>
              </div>
            ):(
              <div style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
                <div style={{fontWeight:700,fontSize:14,color:"#86efac"}}>✅ Tudo pago! Nada a cobrar hoje.</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* LISTA AGRUPADA POR QUADRA */}
      <div style={{padding:"12px 16px 100px"}}>
        {agsDia.length===0&&(
          <div style={{textAlign:"center",padding:"80px 24px",color:"#9ca3af"}}>
            <div style={{fontSize:56,marginBottom:12}}>📭</div>
            <div style={{fontWeight:700,fontSize:18}}>Sem reservas</div>
            <div style={{fontSize:14,marginTop:4}}>para {nomeDia(dia).toLowerCase()}</div>
          </div>
        )}

        {[
          {id:"q2",nome:"Quadra de Areia",subtitulo:"Vôlei · Futevôlei",emoji:"🏐",cor:LA},
          {id:"q1",nome:"Quadra Society",subtitulo:"Futebol Society",emoji:"⚽",cor:V},
        ].map(q=>{
          const agsQ=agsDia.filter(a=>a.qid===q.id);
          if(agsQ.length===0) return null;
          return(
            <div key={q.id} style={{marginBottom:24}}>
              {/* Cabeçalho da quadra */}
              <div style={{background:q.cor,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:48,borderRadius:12,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {q.emoji}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:18,color:"white"}}>{q.nome}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",marginTop:1}}>{q.subtitulo}</div>
                </div>
                <div style={{background:"rgba(255,255,255,0.25)",borderRadius:20,padding:"4px 14px",color:"white",fontWeight:800,fontSize:15}}>
                  {agsQ.length} jogo{agsQ.length!==1?"s":""}
                </div>
              </div>

              {/* Cards */}
              {agsQ.map(a=>{
                const agE=getAg(a.id);
                const sal=saldo(agE);
                const fim=finalizados.includes(a.id);
                return(
                  <div key={a.id} style={{marginBottom:8}}>
                    {/* Card info — abre detalhe */}
                    <div onClick={()=>{setAberto(a.id);setEditPess(false);setNovaPess("");}}
                      style={{background:fim?"#f0fdf4":"white",borderRadius:sal>0?"14px 14px 0 0":14,padding:"16px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",cursor:"pointer",borderLeft:`5px solid ${fim?"#22c55e":q.cor}`,opacity:fim?0.75:1}}>

                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{background:fim?"#22c55e":q.cor,color:"white",borderRadius:10,padding:"6px 16px",fontSize:16,fontWeight:800}}>
                          {a.ini} – {a.fim}
                        </div>
                        {fim&&<Pill bg="#dcfce7" cl="#065f46">✓ Finalizado</Pill>}
                      </div>

                      <div style={{fontWeight:800,fontSize:20,color:"#1a1f2e",marginBottom:8}}>{a.cli}</div>

                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                        {agE.pess&&<Pill bg="#eff6ff" cl="#1e40af">👥 {agE.pess} pessoas</Pill>}
                        {a.sauna&&<Pill bg="#f0fdf4" cl="#065f46">🧖 Sauna</Pill>}
                        {a.churr&&<Pill bg="#fff7ed" cl="#9a3412">🍖 Churrasqueira</Pill>}
                      </div>

                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:12,height:12,borderRadius:"50%",background:isPago(agE.pag)?"#22c55e":isParcial(agE.pag)?"#eab308":"#ef4444",flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:700,color:isPago(agE.pag)?"#065f46":isParcial(agE.pag)?AM:VM}}>
                            {labelPag(agE.pag)}
                          </span>
                        </div>
                        <div style={{fontWeight:700,fontSize:16,color:VE}}>R$ {(agE.val||0).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Botão RECEBIDO */}
                    {sal>0&&(
                      <button onClick={()=>marcarRecebido(a.id)}
                        style={{width:"100%",padding:"14px 16px",background:"#16a34a",color:"white",border:"none",borderRadius:"0 0 14px 14px",fontSize:16,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span>✅ Receber</span>
                        <span>R$ {sal.toFixed(2)}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* MODAL DETALHE */}
      {aberto&&ag&&(
        <div onClick={()=>setAberto(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:"20px 20px 40px"}}>
            <div style={{width:48,height:5,background:"#e0e3e8",borderRadius:3,margin:"0 auto 20px"}}/>

            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
              <div style={{width:56,height:56,borderRadius:14,background:ag.qid==="q1"?V:LA,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                {ag.qid==="q1"?"⚽":"🏐"}
              </div>
              <div>
                <div style={{fontWeight:800,fontSize:22,color:"#1a1f2e"}}>{ag.cli}</div>
                <div style={{fontSize:15,color:"#6b7280",marginTop:2}}>{ag.qnm} · {ag.ini} às {ag.fim}</div>
              </div>
            </div>

            {/* Pagamento */}
            <div style={{borderRadius:14,padding:18,marginBottom:14,background:isPago(ag.pag)?"#f0fdf4":isParcial(ag.pag)?"#fffbeb":"#fef2f2",border:`2px solid ${isPago(ag.pag)?"#86efac":isParcial(ag.pag)?"#fde68a":"#fca5a5"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:salAg>0?14:0}}>
                <div>
                  <div style={{fontWeight:800,fontSize:20,color:isPago(ag.pag)?"#065f46":isParcial(ag.pag)?AM:VM}}>
                    {labelPag(ag.pag)}
                  </div>
                  {salAg>0&&<div style={{fontSize:15,color:VM,fontWeight:700,marginTop:4}}>Cobrar: R$ {salAg.toFixed(2)}</div>}
                </div>
                <div style={{fontWeight:800,fontSize:28,color:VE}}>R${(ag.val||0).toFixed(2)}</div>
              </div>
              {salAg>0&&(
                <button onClick={()=>{setAberto(null);marcarRecebido(ag.id);}}
                  style={{width:"100%",padding:"14px",background:"#16a34a",color:"white",border:"none",borderRadius:10,fontSize:16,fontWeight:800,cursor:"pointer"}}>
                  ✅ Recebido — R$ {salAg.toFixed(2)}
                </button>
              )}
            </div>

            {/* Infos */}
            <div style={{background:"#f9fafb",borderRadius:14,padding:16,marginBottom:14}}>
              {ag.pess&&<InfoLinha icon="👥" texto={`${ag.pess} pessoas na quadra`} destaque/>}
              {ag.sauna&&<InfoLinha icon="🧖" texto="Vai usar a sauna" destaque/>}
              {ag.churr&&<InfoLinha icon="🍖" texto="Churrasqueira reservada" destaque/>}
              {ag.tel&&<InfoLinha icon="📱" texto={ag.tel}/>}
            </div>

            {/* Atualizar pessoas — só areia */}
            {isAreia&&(
              <div style={{background:"#eff6ff",border:"2px solid #bfdbfe",borderRadius:14,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1e40af",marginBottom:12}}>👥 Chegou mais gente?</div>
                {!editPess?(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontWeight:800,fontSize:22,color:"#1e40af"}}>{ag.pess||"?"} pessoas</div>
                    <button onClick={()=>setEditPess(true)}
                      style={{background:"#1e40af",color:"white",border:"none",borderRadius:10,padding:"12px 20px",fontWeight:800,fontSize:15,cursor:"pointer"}}>
                      ✏️ Atualizar
                    </button>
                  </div>
                ):(
                  <div>
                    <div style={{fontSize:13,color:"#374151",marginBottom:10}}>Quantas pessoas estão na quadra agora?</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:10}}>
                      {[6,8,10,12,14,16].map(n=>(
                        <div key={n} onClick={()=>setNovaPess(String(n))}
                          style={{textAlign:"center",padding:"10px 4px",borderRadius:10,border:`2px solid ${novaPess===String(n)?"#1e40af":"#e0e3e8"}`,background:novaPess===String(n)?"#1e40af":"white",color:novaPess===String(n)?"white":"#374151",fontWeight:800,fontSize:16,cursor:"pointer"}}>
                          {n}
                        </div>
                      ))}
                    </div>
                    <input type="number" value={novaPess} onChange={e=>setNovaPess(e.target.value)} min={1} max={60}
                      style={{width:"100%",padding:"12px",border:"2px solid #bfdbfe",borderRadius:10,fontSize:18,fontWeight:800,textAlign:"center",outline:"none",marginBottom:8,color:"#1e40af"}}
                      placeholder="Outro número"/>
                    {novaPess&&parseInt(novaPess)>0&&(
                      <div style={{background:"white",borderRadius:10,padding:"12px",marginBottom:10,textAlign:"center",border:"1px solid #e0e3e8"}}>
                        <div style={{fontWeight:800,fontSize:24,color:"#1e40af"}}>R$ {calcAreia(parseInt(novaPess)).toFixed(2)}/hora</div>
                        {calcAreia(parseInt(novaPess))>(agendamentos.find(x=>x.id===aberto)?.val||0)&&(
                          <div style={{fontWeight:800,color:VM,fontSize:16,marginTop:4}}>
                            ⚠️ Cobrar mais: R$ {(calcAreia(parseInt(novaPess))-(agendamentos.find(x=>x.id===aberto)?.val||0)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <button onClick={()=>{setEditPess(false);setNovaPess("");}}
                        style={{padding:"14px",background:"none",border:"2px solid #e0e3e8",borderRadius:12,fontWeight:700,fontSize:15,cursor:"pointer",color:"#6b7280"}}>
                        Cancelar
                      </button>
                      <button onClick={()=>confirmarPessoas(aberto)} disabled={!novaPess||parseInt(novaPess)<1}
                        style={{padding:"14px",background:(!novaPess||parseInt(novaPess)<1)?"#e0e3e8":"#1e40af",color:"white",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer"}}>
                        ✅ Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {ag.tel&&(
              <a href={`https://wa.me/55${ag.tel.replace(/\D/g,"")}`} target="_blank"
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"16px",background:V,color:"white",borderRadius:14,fontSize:16,fontWeight:800,textDecoration:"none",marginBottom:10}}>
                💬 Chamar no WhatsApp
              </a>
            )}
            <button onClick={()=>setAberto(null)}
              style={{width:"100%",padding:"15px",background:"none",border:"2px solid #e0e3e8",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",color:"#6b7280"}}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({bg,cl,children}){
  return <span style={{background:bg,color:cl,fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20}}>{children}</span>;
}
function InfoLinha({icon,texto,destaque}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f0f0"}}>
      <span style={{fontSize:20,width:28,textAlign:"center",flexShrink:0}}>{icon}</span>
      <span style={{fontSize:15,fontWeight:destaque?700:500,color:destaque?VE:"#374151"}}>{texto}</span>
    </div>
  );
}
