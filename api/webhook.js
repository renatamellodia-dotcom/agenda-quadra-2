export default async function handler(req, res) {
  // Aceitar apenas POST do Mercado Pago
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const MP_TOKEN = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";
  const FUNC_TEL = "5522999815178";
  const RESEND_KEY = "re_EPZUyHnp_2Ane4iXt9DYSzaKtLx2AfA2P";
  const EMAIL_FROM = "reservas@complexomelodia.com.br";
  const EMAIL_ADMIN = "complexoesportivo@gmail.com";

  try {
    const body = req.body;

    // MP envia: { type: "payment", data: { id: "123" } }
    if (body?.type !== "payment") {
      return res.status(200).json({ ok: true, msg: "not a payment event" });
    }

    const paymentId = body?.data?.id;
    if (!paymentId) {
      return res.status(200).json({ ok: true, msg: "no payment id" });
    }

    // 1. Buscar pagamento no MP
    const mpResp = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, {
      headers: { "Authorization": "Bearer " + MP_TOKEN }
    });
    const payment = await mpResp.json();

    if (payment.status !== "approved") {
      return res.status(200).json({ ok: true, msg: "not approved: " + payment.status });
    }

    const extRef = payment.external_reference;
    const tipoPag = (payment.payment_type_id === "pix" || payment.payment_type_id === "bank_transfer") ? "pix" : "cartao";
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
    const docFound = queryResult[0]?.document;
    if (!docFound) {
      return res.status(200).json({ ok: true, msg: "agendamento not found: " + extRef });
    }

    const fields = docFound.fields || {};
    const docPath = docFound.name;
    const agId = docPath.split("/").pop();

    // Se já confirmado, não processa de novo
    // Se já está confirmado, ainda atualiza pag e valPagoOnline (podem estar errados)
    // NÃO retorna aqui — deixa continuar para corrigir o pag

    // 3. Dados da reserva
    const valField = fields.val;
    const valorTotal = valField ? (Number(valField.doubleValue) || Number(valField.integerValue) || 0) : 0;
    const isParcial = valorTotal > 0 && valorPago < valorTotal * 0.75;
    const temSauna = fields.sauna?.booleanValue === true;
    const nomeCliente = fields.cli?.stringValue || "Cliente";
    const quadraNome = fields.qnm?.stringValue || "Quadra";
    const dataAg = fields.data?.stringValue || "";
    const ini = fields.ini?.stringValue || "";
    const fim = fields.fim?.stringValue || "";
    const telCliente = (fields.tel?.stringValue || "").replace(/\D/g, "");
    const emailCliente = fields.email?.stringValue || "";
    const pagCod = isParcial ? "mp_50" : (tipoPag === "pix" ? "mp_pix" : "mp_cartao");
    const valorRestante = isParcial ? valorTotal * 0.5 : 0;
    const dataFmt = dataAg ? dataAg.split("-").reverse().join("/") : "";

    // 4. Atualizar Firebase
    await fetch(
      "https://firestore.googleapis.com/v1/" + docPath + "?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&updateMask.fieldPaths=valPagoOnline&updateMask.fieldPaths=_debugTipoPag&updateMask.fieldPaths=_debugValorPago&updateMask.fieldPaths=_debugValorTotal&updateMask.fieldPaths=_debugPagCod&updateMask.fieldPaths=_debugIsParcial&key=" + FIREBASE_KEY,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            st: { stringValue: "confirmado" },
            pag: { stringValue: pagCod },
            pagamentoId: { stringValue: String(paymentId) },
            valPagoOnline: { doubleValue: valorPago },
            _debugTipoPag: { stringValue: String(payment.payment_type_id || "") },
            _debugValorPago: { doubleValue: valorPago },
            _debugValorTotal: { doubleValue: valorTotal },
            _debugPagCod: { stringValue: pagCod },
            _debugIsParcial: { booleanValue: isParcial }
          }
        })
      }
    );

    // 5. WhatsApp Renata + Shay
    const msgWA = encodeURIComponent(
      "🎾 *Novo agendamento confirmado!*\n\n" +
      "👤 *Cliente:* " + nomeCliente + "\n" +
      "🏟️ *Quadra:* " + quadraNome + "\n" +
      "📅 *Data:* " + dataFmt + "\n" +
      "⏰ *Horário:* " + ini + " às " + fim + "\n" +
      (temSauna ? "🧖 *Sauna:* Sim\n" : "") +
      "💰 *Pago agora:* R$ " + valorPago.toFixed(2) +
      (isParcial ? "\n⏳ *Restante na chegada:* R$ " + valorRestante.toFixed(2) : "\n✅ *Pago total*") + "\n" +
      "📱 *Tel:* " + telCliente + "\n" +
      "🔔 _via webhook_"
    );
    await fetch("https://api.callmebot.com/whatsapp.php?phone=" + RENATA_TEL + "&text=" + msgWA + "&apikey=" + CALLMEBOT_KEY);
    await fetch("https://api.callmebot.com/whatsapp.php?phone=" + FUNC_TEL + "&text=" + msgWA + "&apikey=" + CALLMEBOT_KEY);

    // 6. Email cliente
    if (emailCliente) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Complexo Melodia <" + EMAIL_FROM + ">",
          to: [emailCliente],
          subject: "✅ Reserva Confirmada | " + quadraNome + " | " + dataFmt + " às " + ini + " | Complexo Melodia",
          text: "Olá " + nomeCliente + "! Sua reserva foi confirmada.\n\nData: " + dataFmt + "\nHorário: " + ini + " às " + fim + "\nEspaço: " + quadraNome + "\nPago: R$ " + valorPago.toFixed(2) + (valorRestante > 0 ? "\nSaldo na chegada: R$ " + valorRestante.toFixed(2) : "") + "\n\ncomplexomelodia.com.br"
        })
      });
    }

    // 7. Email admin
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Complexo Melodia <" + EMAIL_FROM + ">",
        to: [EMAIL_ADMIN],
        subject: "📅 Nova Reserva | " + nomeCliente + " | " + quadraNome + " | " + dataFmt + " " + ini,
        text: "Nova reserva confirmada!\n\nCliente: " + nomeCliente + "\nData: " + dataFmt + "\nHorário: " + ini + " às " + fim + "\nEspaço: " + quadraNome + "\nPago: R$ " + valorPago.toFixed(2) + (valorRestante > 0 ? "\nSaldo pendente: R$ " + valorRestante.toFixed(2) : "") + (temSauna ? "\nSauna: Sim" : "") + "\nTel: " + telCliente + "\n🔔 via webhook"
      })
    });

    return res.status(200).json({ ok: true, agId });

  } catch (e) {
    console.error("Webhook erro:", e.message);
    // Sempre retornar 200 para o MP não retentar infinitamente
    return res.status(200).json({ ok: false, erro: e.message });
  }
}
