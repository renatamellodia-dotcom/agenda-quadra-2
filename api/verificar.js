export default async function handler(req, res) {
  const MP = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";
  const FUNC_TEL = "5522999815178";
  const RESEND_KEY = "re_EPZUyHnp_2Ane4iXt9DYSzaKtLx2AfA2P";
  const EMAIL_FROM = "reservas@complexomelodia.com.br";
  const EMAIL_ADMIN = "reservas@complexomelodia.com.br";

  const { id } = req.query;
  if (!id) return res.status(400).json({ aprovado: false });

  try {
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { "Authorization": `Bearer ${MP}` }
    });
    const payment = await mpResp.json();

    if (payment.status !== "approved") {
      return res.status(200).json({ aprovado: false, status: payment.status });
    }

    const extRef = payment.external_reference;
    const tipoPag = payment.payment_type_id === "pix" ? "pix" : "cartao";

    // Busca agendamento pelo extRef
    const queryResp = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "agendamentos" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "extRef" },
                op: "EQUAL",
                value: { stringValue: extRef }
              }
            },
            limit: 1
          }
        })
      }
    );

    const queryResult = await queryResp.json();
    const doc = queryResult[0]?.document;
    if (!doc) return res.status(200).json({ aprovado: true, tipoPag, agId: null });

    const fields = doc.fields || {};
    const docPath = doc.name;
    const agId = docPath.split("/").pop();

    // Se já confirmado, não processa de novo
    if (fields.st?.stringValue === "confirmado") {
      return res.status(200).json({ aprovado: true, tipoPag, agId });
    }

    // Dados da reserva
    const valorTotal  = fields.val?.doubleValue  || fields.val?.integerValue  || 0;
    const valorPago   = payment.transaction_amount || 0;
    const isParcial   = Math.abs(valorPago - valorTotal * 0.5) < 1;
    const temSauna    = fields.sauna?.booleanValue === true;
    const nomeCliente = fields.cli?.stringValue   || "Cliente";
    const quadraNome  = fields.qnm?.stringValue   || "Quadra";
    const dataAg      = fields.data?.stringValue  || "";
    const ini         = fields.ini?.stringValue   || "";
    const fim         = fields.fim?.stringValue   || "";
    const telCliente  = (fields.tel?.stringValue  || "").replace(/\D/g, "");
    const emailCliente = fields.email?.stringValue || "";

    let pagCod = isParcial ? "mp_50" : (tipoPag === "pix" ? "mp_pix" : "mp_cartao");
    const valorRestante = isParcial ? valorTotal * 0.5 : 0;

    // Formata data
    const dataFmt = dataAg ? (([a,m,d]) => `${d}/${m}/${a}`)(dataAg.split("-")) : "";

    // ── Atualiza Firebase ──
    await fetch(
      `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&key=${FIREBASE_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            st:         { stringValue: "confirmado" },
            pag:        { stringValue: pagCod },
            pagamentoId:{ stringValue: String(id) }
          }
        })
      }
    );

    // ── WhatsApp Renata + Shay ──
    const msgWA = encodeURIComponent(
      "🎾 *Novo agendamento confirmado!*\n\n" +
      "👤 *Cliente:* " + nomeCliente + "\n" +
      "🏟️ *Quadra:* " + quadraNome + "\n" +
      "📅 *Data:* " + dataFmt + "\n" +
      "⏰ *Horário:* " + ini + " às " + fim + "\n" +
      (temSauna ? "🧖 *Sauna:* Sim\n" : "") +
      "💰 *Pago agora:* R$ " + valorPago.toFixed(2) +
      (isParcial ? "\n⏳ *Restante na chegada:* R$ " + valorRestante.toFixed(2) : "\n✅ *Pago total*") + "\n" +
      "📱 *Tel:* " + telCliente
    );
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${RENATA_TEL}&text=${msgWA}&apikey=${CALLMEBOT_KEY}`);
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${FUNC_TEL}&text=${msgWA}&apikey=${CALLMEBOT_KEY}`);

    // ── Template de email ──
    const htmlEmail = (destino) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="format-detection" content="telephone=no"/>
  <title>Reserva Confirmada - Complexo Melodia</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:#1a5248;padding:28px 24px 0;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:white;letter-spacing:0.5px;">COMPLEXO MELODIA</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Esporte, lazer e confraternização</div>
      </td></tr>
      <tr><td style="background:#1a5248;padding:20px 24px 28px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.4);display:inline-block;line-height:64px;font-size:30px;">✅</div>
        <div style="font-size:20px;font-weight:800;color:white;margin-top:12px;">
          ${destino === "admin" ? "Nova Reserva Confirmada" : "Reserva Confirmada!"}
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:6px;">
          ${destino === "admin" ? `Cliente: ${nomeCliente}` : "Seu pagamento foi aprovado com sucesso."}
        </div>
      </td></tr>

      <!-- Detalhes -->
      <tr><td style="padding:24px;">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Detalhes da Reserva</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e3e8;border-radius:10px;overflow:hidden;">
          <tr><td style="padding:11px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <span style="color:#6b7280;font-size:13px;">👤 Cliente</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#1a1f2e;">${nomeCliente}</span>
          </td></tr>
          <tr><td style="padding:11px 14px;border-bottom:1px solid #f3f4f6;">
            <span style="color:#6b7280;font-size:13px;">📅 Data</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#1a1f2e;">${dataFmt}</span>
          </td></tr>
          <tr><td style="padding:11px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <span style="color:#6b7280;font-size:13px;">🕐 Horário</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#1a1f2e;">${ini} às ${fim}</span>
          </td></tr>
          <tr><td style="padding:11px 14px;border-bottom:1px solid #f3f4f6;">
            <span style="color:#6b7280;font-size:13px;">🏟️ Espaço</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#1a1f2e;">${quadraNome}</span>
          </td></tr>
          ${temSauna ? `
          <tr><td style="padding:11px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa;">
            <span style="color:#6b7280;font-size:13px;">🧖 Sauna</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#065f46;">Sim — pagamento no local</span>
          </td></tr>` : ""}
          <tr><td style="padding:11px 14px;${valorRestante > 0 ? "border-bottom:1px solid #f3f4f6;" : ""}background:#fafafa;">
            <span style="color:#6b7280;font-size:13px;">💰 Pago online</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#2E7D6B;">R$ ${valorPago.toFixed(2)}</span>
          </td></tr>
          ${valorRestante > 0 ? `
          <tr><td style="padding:11px 14px;">
            <span style="color:#6b7280;font-size:13px;">⏳ Saldo na chegada</span>
            <span style="float:right;font-weight:700;font-size:13px;color:#92400e;">R$ ${valorRestante.toFixed(2)}</span>
          </td></tr>` : ""}
        </table>

        ${valorRestante > 0 ? `
        <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;padding:12px 16px;margin-top:16px;">
          <div style="font-weight:700;color:#92400e;font-size:13px;">⚠️ Valor pendente</div>
          <div style="color:#92400e;font-size:12px;margin-top:4px;">Pague R$ ${valorRestante.toFixed(2)} ao chegar no Complexo.</div>
        </div>` : ""}

        ${temSauna ? `
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-top:12px;">
          <div style="font-weight:700;color:#065f46;font-size:13px;">🧖 Sauna reservada</div>
          <div style="color:#065f46;font-size:12px;margin-top:4px;">O pagamento da sauna é feito no local (R$ 15,00).</div>
        </div>` : ""}
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e0e3e8;">
        <div style="font-size:13px;color:#6b7280;">Dúvidas? Fale com a gente:</div>
        <a href="https://wa.me/5522999008085" style="display:inline-block;margin-top:10px;background:#16a34a;color:white;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:700;text-decoration:none;">💬 WhatsApp do Complexo</a>
        <div style="margin-top:14px;font-size:11px;color:#9ca3af;">complexomelodia.com.br</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    // ── Envia emails em paralelo ──
    const emailPromises = [];

    // Email para o cliente
    if (emailCliente) {
      emailPromises.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `Complexo Melodia <reservas@complexomelodia.com.br>`,
            reply_to: "contato@complexomelodia.com.br",
            to: [emailCliente],
            subject: `Reserva confirmada - ${quadraNome} em ${dataFmt} as ${ini}`,
            headers: {
              "X-Entity-Ref-ID": agId,
              "Precedence": "bulk"
            },
            tags: [
              { name: "category", value: "reserva_confirmada" }
            ],
            text: `Reserva confirmada - Complexo Melodia\n\nOla, ${nomeCliente}!\n\nSua reserva foi confirmada.\n\nData: ${dataFmt}\nHorario: ${ini} as ${fim}\nEspaco: ${quadraNome}\nPago online: R$ ${valorPago.toFixed(2)}${valorRestante > 0 ? "\nSaldo na chegada: R$ " + valorRestante.toFixed(2) : ""}${temSauna ? "\nSauna: Sim (pagamento no local - R$ 15,00)" : ""}\n\nDuvidas? WhatsApp: (22) 99900-8085\ncomplexomelodia.com.br`,
            html: htmlEmail("cliente")
          })
        })
      );
    }

    // Cópia para o admin
    emailPromises.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Complexo Melodia <reservas@complexomelodia.com.br>`,
          reply_to: "reservas@complexomelodia.com.br",
          to: [EMAIL_ADMIN],
          subject: `Nova reserva - ${nomeCliente} | ${quadraNome} | ${dataFmt} ${ini}`,
          headers: {
            "X-Entity-Ref-ID": agId + "-admin",
            "Precedence": "bulk"
          },
          tags: [
            { name: "category", value: "notificacao_admin" }
          ],
          text: `Nova reserva - Complexo Melodia\n\nCliente: ${nomeCliente}\nData: ${dataFmt}\nHorario: ${ini} as ${fim}\nEspaco: ${quadraNome}\nPago: R$ ${valorPago.toFixed(2)}${valorRestante > 0 ? "\nSaldo pendente: R$ " + valorRestante.toFixed(2) : ""}${temSauna ? "\nSauna: Sim" : ""}\nTelefone: ${telCliente}`,
          html: htmlEmail("admin")
        })
      })
    );

    await Promise.all(emailPromises);

    return res.status(200).json({ aprovado: true, tipoPag, agId });

  } catch(e) {
    console.error("Verificar erro:", e.message);
    return res.status(200).json({ aprovado: false, erro: e.message });
  }
}
