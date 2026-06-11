export default async function handler(req, res) {
  const MP_TOKEN = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";
  const SHAY_TEL = "5522999815178";
  const RESEND_KEY = "re_EPZUyHnp_2Ane4iXt9DYSzaKtLx2AfA2P";
  const EMAIL_FROM = "reservas@complexomelodia.com.br";
  const EMAIL_ADMIN = "complexoesportivo@gmail.com";

  const { id } = req.query;
  if (!id) return res.status(400).json({ aprovado: false });

  try {
    // 1. Verificar pagamento no MP
    const mpResp = await fetch("https://api.mercadopago.com/v1/payments/" + id, {
      headers: { "Authorization": "Bearer " + MP_TOKEN }
    });
    const payment = await mpResp.json();

    if (payment.status !== "approved") {
      return res.status(200).json({ aprovado: false, status: payment.status });
    }

    const extRef = payment.external_reference;
    const tipoPag = payment.payment_type_id === "pix" ? "pix" : "cartao";
    const valorPago = payment.transaction_amount || 0;

    // 2. Buscar agendamento no Firebase
    const queryResp = await fetch(
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents:runQuery?key=" + FIREBASE_KEY,
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
    const docFound = queryResult[0] && queryResult[0].document;
    if (!docFound) return res.status(200).json({ aprovado: true, agId: null });

    const fields = docFound.fields || {};
    const docPath = docFound.name;
    const agId = docPath.split("/").pop();

    // Se já confirmado, não processa de novo
    if (fields.st && fields.st.stringValue === "confirmado") {
      return res.status(200).json({ aprovado: true, agId });
    }

    // 3. Dados da reserva
    const valorTotal = fields.val ? (fields.val.doubleValue || fields.val.integerValue || 0) : 0;
    const isParcial = valorTotal > 0 && valorPago < valorTotal * 0.75;
    const temSauna = fields.sauna && fields.sauna.booleanValue === true;
    const nomeCliente = fields.cli ? fields.cli.stringValue : "Cliente";
    const quadraNome = fields.qnm ? fields.qnm.stringValue : "Quadra";
    const dataAg = fields.data ? fields.data.stringValue : "";
    const ini = fields.ini ? fields.ini.stringValue : "";
    const fim = fields.fim ? fields.fim.stringValue : "";
    const telCliente = fields.tel ? fields.tel.stringValue.replace(/\D/g,"") : "";
    const emailCliente = fields.email ? fields.email.stringValue : "";

    const pagCod = isParcial ? "mp_50" : (tipoPag === "pix" ? "mp_pix" : "mp_cartao");
    const valorRestante = isParcial ? valorTotal * 0.5 : 0;

    // Formata data
    const dataFmt = dataAg ? dataAg.split("-").reverse().join("/") : "";

    // 4. Atualiza Firebase
    await fetch(
      "https://firestore.googleapis.com/v1/" + docPath + "?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&key=" + FIREBASE_KEY,
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

    // 5. WhatsApp Renata e Shay
    const msgWA = encodeURIComponent(
      "Novo agendamento confirmado!\n\n" +
      "Cliente: " + nomeCliente + "\n" +
      "Quadra: " + quadraNome + "\n" +
      "Data: " + dataFmt + "\n" +
      "Horario: " + ini + " as " + fim + "\n" +
      (temSauna ? "Sauna: Sim\n" : "") +
      "Pago: R$ " + valorPago.toFixed(2) +
      (isParcial ? "\nRestante na chegada: R$ " + valorRestante.toFixed(2) : " (total)") + "\n" +
      "Tel: " + telCliente
    );

    await fetch("https://api.callmebot.com/whatsapp.php?phone=" + RENATA_TEL + "&text=" + msgWA + "&apikey=" + CALLMEBOT_KEY);
    await fetch("https://api.callmebot.com/whatsapp.php?phone=" + SHAY_TEL + "&text=" + msgWA + "&apikey=" + CALLMEBOT_KEY);

    // 6. Email para cliente
    if (emailCliente) {
      const htmlCliente = "<html><body style='font-family:system-ui;background:#f4f5f7;padding:32px 16px'>" +
        "<div style='max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden'>" +
        "<div style='background:#1a5248;padding:28px 24px;text-align:center'>" +
        "<div style='font-size:22px;font-weight:900;color:white'>COMPLEXO MELODIA</div>" +
        "<div style='font-size:32px;margin-top:16px'>✅</div>" +
        "<div style='font-size:20px;font-weight:800;color:white;margin-top:8px'>Reserva Confirmada!</div>" +
        "</div>" +
        "<div style='padding:24px'>" +
        "<table width='100%' style='border:1px solid #e0e3e8;border-radius:10px;overflow:hidden'>" +
        "<tr><td style='padding:10px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa'><span style='color:#6b7280;font-size:13px'>Cliente</span><span style='float:right;font-weight:700;font-size:13px'>" + nomeCliente + "</span></td></tr>" +
        "<tr><td style='padding:10px 14px;border-bottom:1px solid #f3f4f6'><span style='color:#6b7280;font-size:13px'>Data</span><span style='float:right;font-weight:700;font-size:13px'>" + dataFmt + "</span></td></tr>" +
        "<tr><td style='padding:10px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa'><span style='color:#6b7280;font-size:13px'>Horário</span><span style='float:right;font-weight:700;font-size:13px'>" + ini + " às " + fim + "</span></td></tr>" +
        "<tr><td style='padding:10px 14px;border-bottom:1px solid #f3f4f6'><span style='color:#6b7280;font-size:13px'>Espaço</span><span style='float:right;font-weight:700;font-size:13px'>" + quadraNome + "</span></td></tr>" +
        (temSauna ? "<tr><td style='padding:10px 14px;border-bottom:1px solid #f3f4f6;background:#fafafa'><span style='color:#6b7280;font-size:13px'>Sauna</span><span style='float:right;font-weight:700;font-size:13px;color:#065f46'>Sim - pagamento no local</span></td></tr>" : "") +
        "<tr><td style='padding:10px 14px" + (valorRestante > 0 ? ";border-bottom:1px solid #f3f4f6" : "") + ";background:#fafafa'><span style='color:#6b7280;font-size:13px'>Pago online</span><span style='float:right;font-weight:700;font-size:13px;color:#2E7D6B'>R$ " + valorPago.toFixed(2) + "</span></td></tr>" +
        (valorRestante > 0 ? "<tr><td style='padding:10px 14px'><span style='color:#6b7280;font-size:13px'>Saldo na chegada</span><span style='float:right;font-weight:700;font-size:13px;color:#92400e'>R$ " + valorRestante.toFixed(2) + "</span></td></tr>" : "") +
        "</table>" +
        "</div>" +
        "<div style='background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e0e3e8'>" +
        "<a href='https://wa.me/5522999008085' style='display:inline-block;background:#16a34a;color:white;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:700;text-decoration:none'>WhatsApp do Complexo</a>" +
        "<div style='margin-top:12px;font-size:11px;color:#9ca3af'>complexomelodia.com.br</div>" +
        "</div></div></body></html>";

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Complexo Melodia <" + EMAIL_FROM + ">",
          reply_to: EMAIL_FROM,
          to: [emailCliente],
          subject: "✅ Reserva Confirmada | " + quadraNome + " | " + dataFmt + " às " + ini + " | Complexo Melodia",
          text: "Ola " + nomeCliente + "! Sua reserva foi confirmada.\n\nData: " + dataFmt + "\nHorario: " + ini + " as " + fim + "\nEspaco: " + quadraNome + "\nPago: R$ " + valorPago.toFixed(2) + (valorRestante > 0 ? "\nSaldo na chegada: R$ " + valorRestante.toFixed(2) : "") + "\n\ncomplexomelodia.com.br",
          html: htmlCliente
        })
      });
    }

    // 7. Email para admin
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Complexo Melodia <" + EMAIL_FROM + ">",
        reply_to: EMAIL_FROM,
        to: [EMAIL_ADMIN],
        subject: "📅 Nova Reserva | " + nomeCliente + " | " + quadraNome + " | " + dataFmt + " " + ini,
        text: "Nova reserva confirmada!\n\nCliente: " + nomeCliente + "\nData: " + dataFmt + "\nHorario: " + ini + " as " + fim + "\nEspaco: " + quadraNome + "\nPago: R$ " + valorPago.toFixed(2) + (valorRestante > 0 ? "\nSaldo pendente: R$ " + valorRestante.toFixed(2) : "") + (temSauna ? "\nSauna: Sim" : "") + "\nTel: " + telCliente
      })
    });

    return res.status(200).json({ aprovado: true, agId });

  } catch(e) {
    console.error("Erro verificar:", e.message);
    return res.status(200).json({ aprovado: false, erro: e.message });
  }
}
