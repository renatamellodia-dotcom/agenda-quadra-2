export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const MP = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const dados = req.body;
  try {
    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP}`,
        "X-Idempotency-Key": dados.extRef
      },
      body: JSON.stringify({
        transaction_amount: parseFloat(dados.valor),
        description: `Complexo Melodia — ${dados.quadraNome} ${dados.data} ${dados.ini}`,
        payment_method_id: "pix",
        notification_url: "https://complexomelodia.com.br/api/webhook",
        external_reference: dados.extRef,
        payer: {
          first_name: (dados.nome || "Cliente").split(" ")[0],
          last_name: (dados.nome || "Cliente").split(" ").slice(1).join(" ") || ".",
          email: dados.email || "cliente@email.com",
          identification: { type: "CPF", number: (dados.cpf || "").replace(/\D/g, "") }
        }
      })
    });
    const json = await resp.json();
    const pix = json.point_of_interaction?.transaction_data;
    if (!pix) return res.status(500).json({ error: "Pix não gerado", detalhes: json });
    res.status(200).json({
      pagamentoId: String(json.id),
      qrCode: pix.qr_code,
      qrCodeBase64: pix.qr_code_base64
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
