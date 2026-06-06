import { useEffect, useState } from "react";

export default function Confirmado() {
  const [contador, setContador] = useState(10);

  useEffect(() => {
    const t = setInterval(() => {
      setContador(c => {
        if (c <= 1) { clearInterval(t); window.location.href = "/"; return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:"#f0fdf4",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"white",borderRadius:24,padding:40,maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 8px 40px rgba(0,0,0,0.1)"}}>
        <div style={{fontSize:72,marginBottom:16}}>✅</div>
        <h1 style={{fontSize:24,fontWeight:800,color:"#065f46",marginBottom:8}}>Reserva Confirmada!</h1>
        <p style={{color:"#6b7280",fontSize:15,marginBottom:24}}>
          Seu pagamento foi aprovado e sua reserva está confirmada.<br/>
          Você receberá uma mensagem de confirmação no WhatsApp.
        </p>
        <div style={{background:"#f0fdf4",borderRadius:12,padding:16,marginBottom:24,border:"1.5px solid #bbf7d0"}}>
          <div style={{fontSize:13,color:"#065f46",fontWeight:600}}>📍 Complexo Esportivo Melodia</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Qualquer dúvida, entre em contato pelo WhatsApp</div>
        </div>
        <button onClick={()=>window.location.href="/"} style={{width:"100%",padding:"14px",background:"#2E7D6B",color:"white",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"}}>
          Fazer nova reserva
        </button>
        <div style={{marginTop:16,fontSize:12,color:"#9ca3af"}}>
          Redirecionando em {contador}s...
        </div>
      </div>
    </div>
  );
}
