import { useState } from "react";

const V = "#2d6a4f";
const LA = "#E8861A";
const WPP = "5522999008085";

export default function Evento() {
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [buffet, setBuffet] = useState("");
  const [drinks, setDrinks] = useState("");
  const [sauna, setSauna] = useState("");
  const [obs, setObs] = useState("");

  function enviarWhatsApp() {
    const tipoLabel = tipo === "simples"
      ? "Evento Simples"
      : "Evento Exclusivo";

    const msg = [
      `*Solicitação de Evento — Complexo Melodia*`,
      ``,
      `*Tipo:* ${tipoLabel}`,
      ``,
      `*Nome:* ${nome}`,
      `*Telefone:* ${tel}`,
      `*Data desejada:* ${data ? new Date(data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}`,
      `*Horário desejado:* ${horario || "—"}`,
      `*Nº de convidados:* ${pessoas}`,
      `*Buffet externo:* ${buffet === "sim" ? "Sim" : "Não"}`,
      `*Serviço de drinks:* ${drinks === "sim" ? "Sim" : "Não"}`,
      `*Sauna:* ${sauna === "sim" ? "Sim" : "Não"}`,
      obs ? `*Observações:* ${obs}` : null,
    ].filter(Boolean).join("\n");

    window.open(`https://wa.me/${WPP}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const podeSalvar = nome && tel && data && horario && pessoas && buffet && drinks && sauna;

  const inp = {
    width: "100%", padding: "13px 14px",
    border: "1.5px solid #e0e3e8", borderRadius: 10,
    fontSize: 15, fontFamily: "system-ui,sans-serif",
    outline: "none", boxSizing: "border-box", background: "white"
  };

  const lbl = {
    fontSize: 13, fontWeight: 700, color: "#374151",
    display: "block", marginBottom: 6
  };

  function RadioGroup({ label, value, onChange }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>{label}</label>
        <div style={{ display: "flex", gap: 10 }}>
          {["Sim", "Não"].map(op => (
            <button key={op} onClick={() => onChange(op.toLowerCase())}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: `2px solid ${value === op.toLowerCase() ? V : "#e0e3e8"}`,
                background: value === op.toLowerCase() ? "#f0fdf4" : "white",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                color: value === op.toLowerCase() ? V : "#374151"
              }}>
              {op}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: V, padding: "28px 20px 24px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Complexo Esportivo Melodia
        </div>
        <div style={{ fontWeight: 900, fontSize: 22, color: "white", lineHeight: 1.3 }}>
          🎉 Eventos no Complexo Melodia
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 8, lineHeight: 1.5 }}>
          Preencha o formulário e entraremos em contato com seu orçamento personalizado.
        </div>
      </div>

      <div style={{ padding: "20px 16px 100px" }}>

        {/* ESCOLHA DO TIPO */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#374151", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Qual o tipo de evento que deseja realizar?
          </div>

          {/* SIMPLES */}
          <button onClick={() => setTipo("simples")}
            style={{
              width: "100%", textAlign: "left", padding: "18px 16px",
              background: "white", borderRadius: 14, marginBottom: 10, cursor: "pointer",
              border: `2px solid ${tipo === "simples" ? V : "#e0e3e8"}`,
              boxShadow: tipo === "simples" ? "0 0 0 3px rgba(45,106,79,0.1)" : "none"
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${tipo === "simples" ? V : "#9ca3af"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {tipo === "simples" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: V }} />}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1f2e" }}>EVENTO SIMPLES</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", marginBottom: 10 }}>
              Aniversário pequeno, confraternização entre amigos ou reunião familiar
            </div>
            {[
              "Até 20 pessoas",
              "Uso da quadra escolhida durante o período reservado",
              "Churrasqueira exclusiva durante o evento",
              "Uso máximo da churrasqueira de até 5 horas",
              "Valor da quadra conforme horário reservado",
              "Taxa de limpeza e estrutura: R$ 200,00",
              "Crédito de consumo antecipado no bar: R$ 200,00",
              "O valor do crédito poderá ser utilizado durante o evento em bebidas e produtos do bar",
              "Sauna opcional: R$ 15,00 por pessoa",
              "As demais áreas do Complexo permanecerão em funcionamento para outros clientes",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 13, color: "#374151", lineHeight: 1.4 }}>
                <span style={{ color: V, flexShrink: 0 }}>•</span>
                <span>{item}</span>
              </div>
            ))}
          </button>

          {/* EXCLUSIVO */}
          <button onClick={() => setTipo("exclusivo")}
            style={{
              width: "100%", textAlign: "left", padding: "18px 16px",
              background: "white", borderRadius: 14, cursor: "pointer",
              border: `2px solid ${tipo === "exclusivo" ? "#1a1f2e" : "#e0e3e8"}`,
              boxShadow: tipo === "exclusivo" ? "0 0 0 3px rgba(26,31,46,0.1)" : "none"
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${tipo === "exclusivo" ? "#1a1f2e" : "#9ca3af"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {tipo === "exclusivo" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1a1f2e" }} />}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1f2e" }}>EVENTO EXCLUSIVO</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", marginBottom: 10 }}>
              Aniversários, confraternizações de empresas e eventos de maior porte
            </div>
            {[
              "Fechamento exclusivo do Complexo Melodia",
              "Utilização das duas quadras",
              "Churrasqueiras e áreas comuns reservadas exclusivamente para o evento",
              "Possibilidade de extensão de horário mediante consulta prévia",
              "Valor calculado conforme período reservado",
              "Consumo no bar do espaço",
              "Serviço de drinks e bartender (opcional)",
              "Buffet externo (opcional)",
              "Sauna opcional: R$ 15,00 por pessoa",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 13, color: "#374151", lineHeight: 1.4 }}>
                <span style={{ color: "#1a1f2e", flexShrink: 0 }}>•</span>
                <span>{item}</span>
              </div>
            ))}
          </button>
        </div>

        {/* DADOS DO EVENTO */}
        {tipo && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#374151", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
              Dados do Evento
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Nome do responsável</label>
              <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Telefone</label>
              <input style={inp} type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="(22) 99999-9999" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Data desejada</label>
              <input style={inp} type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Horário desejado</label>
              <input style={inp} value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ex: 14h às 19h" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Número de convidados</label>
              <input style={inp} type="number" value={pessoas} onChange={e => setPessoas(e.target.value)} placeholder="Quantas pessoas?" min="1" />
            </div>

            <RadioGroup label="Haverá buffet externo?" value={buffet} onChange={setBuffet} />
            <RadioGroup label="Deseja serviço de drinks?" value={drinks} onChange={setDrinks} />
            <RadioGroup label="Deseja utilização da sauna?" value={sauna} onChange={setSauna} />

            <div>
              <label style={lbl}>Observações</label>
              <textarea style={{ ...inp, height: 90, resize: "none" }}
                value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Tema do evento, necessidades especiais, dúvidas..." />
            </div>
          </div>
        )}

        {/* BOTÃO ENVIAR */}
        {tipo && (
          <button onClick={enviarWhatsApp} disabled={!podeSalvar}
            style={{
              width: "100%", padding: "16px",
              background: podeSalvar ? "#25d366" : "#9ca3af",
              color: "white", border: "none", borderRadius: 14,
              fontSize: 16, fontWeight: 800,
              cursor: podeSalvar ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10
            }}>
            <span style={{ fontSize: 20 }}>💬</span>
            Enviar solicitação pelo WhatsApp
          </button>
        )}
        {tipo && !podeSalvar && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            Preencha todos os campos para continuar
          </div>
        )}

      </div>
    </div>
  );
}
