export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).end();

  const MP_ACCESS_TOKEN = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const FIREBASE_KEY = "AIzaSyAX5kKNmUsqs6g0eD_wpbRAalcu1A8ViWI";
  const PROJECT_ID = "agendamento-quadras-ad13b";
  const CALLMEBOT_KEY = "3912259";
  const RENATA_TEL = "5522999008085";

  try {
    const { type, data } = req.body || {};
    if (type !== "payment" || !data?.id) return res.status(200).end();

    // Busca detalhes do pagamento no MP
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
    });
    const payment = await mpResp.json();
    if (payment.status !== "approved") return res.status(200).end();

    const extRef = payment.external_reference;
    if (!extRef) return res.status(200).end();

    // Busca agendamento pelo extRef no Firestore REST
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
    if (!doc) return res.status(200).json({ ok: true, msg: "nao encontrado" });

    const fields = doc.fields || {};
    const docPath = doc.name;

    // Atualiza status para confirmado
    await fetch(
      `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&key=${FIREBASE_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            st: { stringValue: "confirmado" },
            pag: { stringValue: payment.payment_type_id === "pix" ? "mp_pix" : "mp_cartao" },
            pagamentoId: { stringValue: String(data.id) }
          }
        })
      }
    );

    // Dados do agendamento
    const nomeCliente = fields.cli?.stringValue || fields.nome?.stringValue || "Cliente";
    const quadraNome = fields.qnm?.stringValue || fields.quadraNome?.stringValue || "Quadra";
    const dataAg = fields.data?.stringValue || "";
    const ini = fields.ini?.stringValue || "";
    const fim = fields.fim?.stringValue || "";
    const valor = fields.val?.doubleValue || fields.val?.integerValue || fields.valor?.doubleValue || "";
    const telCliente = fields.tel?.stringValue || "";
    const emailCliente = fields.email?.stringValue || "";

    // WhatsApp para a Renata
    const msgRenata = encodeURIComponent(
      "🎾 *Novo agendamento confirmado!*\n\n" +
      "👤 *Cliente:* " + nomeCliente + "\n" +
      "🏟️ *Quadra:* " + quadraNome + "\n" +
      "📅 *Data:* " + dataAg + "\n" +
      "⏰ *Horário:* " + ini + " às " + fim + "\n" +
      "💰 *Valor pago:* R$ " + valor + "\n" +
      "📱 *Tel:* " + telCliente
    );
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${RENATA_TEL}&text=${msgRenata}&apikey=${CALLMEBOT_KEY}`);

    // WhatsApp para o cliente
    if (telCliente) {
      const telLimpo = telCliente.replace(/\D/g, "");
      const telIntl = telLimpo.startsWith("55") ? telLimpo : "55" + telLimpo;
      const msgCliente = encodeURIComponent(
        "✅ *Reserva confirmada — Complexo Melodia!*\n\n" +
        "Olá, " + nomeCliente + "! Seu pagamento foi aprovado.\n\n" +
        "🏟️ *Quadra:* " + quadraNome + "\n" +
        "📅 *Data:* " + dataAg + "\n" +
        "⏰ *Horário:* " + ini + " às " + fim + "\n\n" +
        "Qualquer dúvida entre em contato. Até lá! 🎾"
      );
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${telIntl}&text=${msgCliente}&apikey=${CALLMEBOT_KEY}`);
    }

    res.status(200).json({ ok: true });
  } catch(e) {
    console.error("Webhook error:", e.message);
    res.status(200).json({ error: e.message });
  }
}
