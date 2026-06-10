import { useEffect, useState } from "react";

const VE = "#1a5248";

export default function Confirmado() {
  const [contador, setContador] = useState(15);
  const [status, setStatus] = useState("verificando");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id");
    const statusMP = params.get("status");
    const collectionStatus = params.get("collection_status"); // MP também envia isso

    async function confirmar() {
      // MP aprovou — mostrar confirmado independente do que o verificar retornar
      const mpAprovado = statusMP === "approved" || collectionStatus === "approved";

      // Chamar verificar UMA vez — confirma no Firebase, envia WhatsApp e email
      if (paymentId) {
        try {
          const resp = await fetch(`/api/verificar?id=${paymentId}`);
          const json = await resp.json();
          // Se MP aprovou OU verificar confirmou, mostrar tela de sucesso
          if (mpAprovado || json.aprovado) {
            setStatus("confirmado");
          } else {
            setStatus("erro");
          }
        } catch(e) {
          // Se verificar falhou mas MP disse approved, mostrar confirmado mesmo assim
          setStatus(mpAprovado ? "confirmado" : "erro");
        }
        return;
      }

      // Sem informação nenhuma
      setStatus("erro");
    }

    confirmar();
  }, []);

  // Countdown para redirecionar
  useEffect(() => {
    if (status === "verificando") return;
    const t = setInterval(() => {
      setContador(c => {
        if (c <= 1) { clearInterval(t); window.location.href = "/"; return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status === "verificando") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:VE,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:60,height:60,border:"4px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",margin:"0 auto 20px",animation:"spin 1s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontWeight:700,fontSize:18,color:"white"}}>Confirmando pagamento...</div>
        <div style={{color:"rgba(255,255,255,0.6)",fontSize:14,marginTop:8}}>Aguarde um instante</div>
      </div>
    </div>
  );

  if (status === "erro") return (
    <div style={{fontFamily:"system-ui,sans-serif",background:"#7f1d1d",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:40,maxWidth:400,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:16}}>⚠️</div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#991b1b",marginBottom:8}}>Pagamento não confirmado</h1>
        <p style={{color:"#6b7280",fontSize:15,marginBottom:24}}>
          Se o pagamento foi efetuado, aguarde o e-mail de confirmação ou entre em contato conosco.
        </p>
        <a href="https://wa.me/5522999008085"
          style={{display:"block",padding:"14px",background:"#16a34a",color:"white",borderRadius:12,fontSize:15,fontWeight:700,textDecoration:"none",marginBottom:12}}>
          💬 Falar com o Complexo
        </a>
        <button onClick={()=>window.location.href="/"} style={{width:"100%",padding:"12px",background:"none",border:"1.5px solid #e0e3e8",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
          Voltar ao início
        </button>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:VE,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"4px solid rgba(255,255,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:24}}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <path d="M14 27L22 35L38 18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontWeight:800,fontSize:30,color:"white",marginBottom:8}}>Reserva Confirmada!</div>
        <div style={{color:"rgba(255,255,255,0.65)",fontSize:15,lineHeight:1.6}}>
          Tudo certo! Te esperamos no Complexo Melodia. 🎾<br/>
          Você receberá a confirmação por e-mail em instantes.
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,0.1)",borderRadius:16,padding:"14px 24px",marginBottom:20,textAlign:"center"}}>
        <div style={{color:"rgba(255,255,255,0.6)",fontSize:13}}>Redirecionando em {contador}s...</div>
      </div>
      <button onClick={()=>window.location.href="/"} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"white",padding:"16px 32px",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer"}}>
        Fazer outra reserva
      </button>
    </div>
  );
}
