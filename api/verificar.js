export default async function handler(req, res) {
  const MP = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";
  const FUNC_TEL = "5522999815178";
  const RESEND_KEY = "re_EPZUyHnp_2Ane4iXt9DYSzaKtLx2AfA2P";
  const EMAIL_FROM = "reservas@complexomelodia.com.br";

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

    // Detecta se foi pagamento parcial (50%) ou total
    const valorTotal = fields.val?.doubleValue || fields.val?.integerValue || 0;
    const valorPago = payment.transaction_amount || 0;
    const isParcial = Math.abs(valorPago - valorTotal * 0.5) < 1;

    let pagCod;
    if (isParcial) {
      pagCod = "mp_50";
    } else {
      pagCod = tipoPag === "pix" ? "mp_pix" : "mp_cartao";
    }

    const valorRestante = isParcial ? valorTotal * 0.5 : 0;

    // Atualiza Firebase
    await fetch(
      `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&key=${FIREBASE_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            st: { stringValue: "confirmado" },
            pag: { stringValue: pagCod },
            pagamentoId: { stringValue: String(id) }
          }
        })
      }
    );

    const nomeCliente = fields.cli?.stringValue || "Cliente";
    const quadraNome = fields.qnm?.stringValue || "Quadra";
    const dataAg = fields.data?.stringValue || "";
    const ini = fields.ini?.stringValue || "";
    const fim = fields.fim?.stringValue || "";
    const telCliente = (fields.tel?.stringValue || "").replace(/\D/g, "");
    const emailCliente = fields.email?.stringValue || "";

    // Formata data para exibição
    const dataFmt = dataAg ? (() => {
      const [a,m,d] = dataAg.split("-");
      return `${d}/${m}/${a}`;
    })() : "";

    // ── WhatsApp Renata ──
    const msgRenata = encodeURIComponent(
      "🎾 *Novo agendamento confirmado!*\n\n" +
      "👤 *Cliente:* " + nomeCliente + "\n" +
      "🏟️ *Quadra:* " + quadraNome + "\n" +
      "📅 *Data:* " + dataFmt + "\n" +
      "⏰ *Horário:* " + ini + " às " + fim + "\n" +
      "💰 *Valor pago agora:* R$ " + valorPago.toFixed(2) +
      (isParcial ? "\n⏳ *Restante na chegada:* R$ " + valorRestante.toFixed(2) : "\n✅ *Pago total*") + "\n" +
      "📱 *Tel:* " + telCliente
    );
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${RENATA_TEL}&text=${msgRenata}&apikey=${CALLMEBOT_KEY}`);
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${FUNC_TEL}&text=${msgRenata}&apikey=${CALLMEBOT_KEY}`);

    // ── Email de confirmação para o cliente ──
    if (emailCliente) {
      const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#1a5248;padding:28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:white;letter-spacing:0.5px;">COMPLEXO MELODIA</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Esporte, lazer e confraternização!</div>
        </td></tr>

        <!-- Ícone de sucesso -->
        <tr><td style="background:#1a5248;padding:0 24px 28px;text-align:center;">
          <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.4);display:inline-flex;align-items:center;justify-content:center;font-size:32px;">✅</div>
          <div style="font-size:22px;font-weight:800;color:white;margin-top:12px;">Reserva Confirmada!</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:6px;">Seu pagamento foi aprovado com sucesso.</div>
        </td></tr>

        <!-- Detalhes -->
        <tr><td style="padding:24px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Detalhes da Reserva</div>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:16px;">📅</span>
              <span style="color:#6b7280;font-size:14px;margin-left:8px;">Data</span>
              <span style="float:right;font-weight:700;font-size:14px;color:#1a1f2e;">${dataFmt}</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:16px;">🕐</span>
              <span style="color:#6b7280;font-size:14px;margin-left:8px;">Horário</span>
              <span style="float:right;font-weight:700;font-size:14px;color:#1a1f2e;">${ini} às ${fim}</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:16px;">🏟️</span>
              <span style="color:#6b7280;font-size:14px;margin-left:8px;">Espaço reservado</span>
              <span style="float:right;font-weight:700;font-size:14px;color:#1a1f2e;">${quadraNome}</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:16px;">💰</span>
              <span style="color:#6b7280;font-size:14px;margin-left:8px;">Pago online</span>
              <span style="float:right;font-weight:700;font-size:14px;color:#2E7D6B;">R$ ${valorPago.toFixed(2)}</span>
            </td></tr>
            ${isParcial ? `
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:16px;">⏳</span>
              <span style="color:#6b7280;font-size:14px;margin-left:8px;">Saldo na chegada</span>
              <span style="float:right;font-weight:700;font-size:14px;color:#92400e;">R$ ${valorRestante.toFixed(2)}</span>
            </td></tr>` : ""}
          </table>

          ${isParcial ? `
          <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;padding:14px 16px;margin-top:16px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">⚠️</span>
            <div>
              <div style="font-weight:700;color:#92400e;font-size:14px;">Valor a pagar no Complexo</div>
              <div style="color:#92400e;font-size:13px;margin-top:2px;">Saldo pendente: R$ ${valorRestante.toFixed(2)} — pague ao chegar.</div>
            </div>
          </div>` : ""}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e0e3e8;">
          <div style="font-size:13px;color:#6b7280;">Qualquer dúvida, fale com a gente:</div>
          <a href="https://wa.me/5522999008085" style="display:inline-block;margin-top:10px;background:#16a34a;color:white;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:700;text-decoration:none;">💬 WhatsApp do Complexo</a>
          <div style="margin-top:16px;font-size:11px;color:#9ca3af;">complexomelodia.com.br</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `Complexo Melodia <${EMAIL_FROM}>`,
          to: [emailCliente],
          subject: `✅ Reserva confirmada — ${quadraNome} · ${dataFmt} · ${ini}`,
          html: htmlEmail
        })
      });
    }

    return res.status(200).json({ aprovado: true, tipoPag, agId });

  } catch(e) {
    console.error("Verificar erro:", e.message);
    return res.status(200).json({ aprovado: false, erro: e.message });
  }
}
