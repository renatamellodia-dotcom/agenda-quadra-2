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
    const metodo = payment.payment_type_id === "pix" ? "pix" : "cartao";

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

    if (!doc) return res.status(200).json({ aprovado: true, metodo, agId: null });

    const fields = doc.fields || {};
    const docPath = doc.name;
    const agId = docPath.split("/").pop();

    // Se já confirmado, não processa de novo
    if (fields.st?.stringValue === "confirmado") {
      return res.status(200).json({ aprovado: true, metodo, agId });
    }

    // Atualiza Firebase
    await fetch(
      `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=st&updateMask.fieldPaths=pag&updateMask.fieldPaths=pagamentoId&key=${FIREBASE_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            st: { stringValue: "confirmado" },
            pag: { stringValue: metodo === "pix" ? "mp_pix" : "mp_cartao" },
            pagamentoId: { stringValue: String(id) }
          }
        })
      }
    );

    // WhatsApp Renata
    const nomeCliente = fields.cli?.stringValue || "Cliente";
    const quadraNome = fields.qnm?.stringValue || "Quadra";
    const dataAg = fields.data?.stringValue || "";
    const ini = fields.ini?.stringValue || "";
    const fim = fields.fim?.stringValue || "";
    const valor = fields.val?.doubleValue || fields.val?.integerValue || "";
    const telCliente = (fields.tel?.stringValue || "").replace(/\D/g, "");

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

    // WhatsApp cliente
    if (telCliente) {
      const telIntl = telCliente.startsWith("55") ? telCliente : "55" + telCliente;
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

    return res.status(200).json({ aprovado: true, metodo, agId });

  } catch(e) {
    console.error("Verificar erro:", e.message);
    return res.status(200).json({ aprovado: false, erro: e.message });
  }
}
