export default async function handler(req, res) {
  const MP = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";

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
    const isParcial = Math.abs(valorPago - valorTotal * 0.5) < 1; // margem de R$1

    // Define o código de pagamento correto
    let pagCod;
    if (isParcial) {
      pagCod = tipoPag === "pix" ? "mp_50" : "mp_50";
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

    // WhatsApp Renata
    const msgRenata = encodeURIComponent(
      "🎾 *Novo agendamento confirmado!*\n\n" +
      "👤 *Cliente:* " + nomeCliente + "\n" +
      "🏟️ *Quadra:* " + quadraNome + "\n" +
      "📅 *Data:* " + dataAg + "\n" +
      "⏰ *Horário:* " + ini + " às " + fim + "\n" +
      "💰 *Valor pago agora:* R$ " + valorPago.toFixed(2) +
      (isParcial ? "\n⏳ *Restante na chegada:* R$ " + valorRestante.toFixed(2) : "\n✅ *Pago total*") + "\n" +
      "📱 *Tel:* " + telCliente
    );
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${RENATA_TEL}&text=${msgRenata}&apikey=${CALLMEBOT_KEY}`);
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${FUNC_TEL}&text=${msgRenata}&apikey=${CALLMEBOT_KEY}`);

    // WhatsApp cliente
    if (telCliente) {
      const telIntl = telCliente.startsWith("55") ? telCliente : "55" + telCliente;
      const msgCliente = encodeURIComponent(
        "✅ *Reserva confirmada — Complexo Melodia!*\n\n" +
        "Olá, " + nomeCliente + "! Seu pagamento foi aprovado.\n\n" +
        "🏟️ *Quadra:* " + quadraNome + "\n" +
        "📅 *Data:* " + dataAg + "\n" +
        "⏰ *Horário:* " + ini + " às " + fim + "\n" +
        "💰 *Pago agora:* R$ " + valorPago.toFixed(2) +
        (isParcial ? "\n⏳ *Restante na chegada:* R$ " + valorRestante.toFixed(2) : "") + "\n\n" +
        "Qualquer dúvida entre em contato. Até lá! 🎾"
      );
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${telIntl}&text=${msgCliente}&apikey=${CALLMEBOT_KEY}`);
    }

    return res.status(200).json({ aprovado: true, tipoPag, agId });

  } catch(e) {
    console.error("Verificar erro:", e.message);
    return res.status(200).json({ aprovado: false, erro: e.message });
  }
}
