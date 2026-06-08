export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const MP = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const dados = req.body;
  const metodo = dados.metodoPagamento || "pix";

  try {
    if (metodo === "cartao") {
      // Cartão → cria preferência MP (checkout externo)
      const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP}`
        },
        body: JSON.stringify({
          items: [{
            title: `Complexo Melodia — ${dados.quadraNome} ${dados.data} ${dados.ini}`,
            quantity: 1,
            unit_price: parseFloat(dados.valor),
            currency_id: "BRL"
          }],
          payer: {
            name: (dados.nome || "Cliente").split(" ")[0],
            surname: (dados.nome || "Cliente").split(" ").slice(1).join(" ") || ".",
            email: dados.email || "cliente@email.com"
          },
          external_reference: dados.extRef,
          notification_url: "https://complexomelodia.com.br/api/webhook",
          back_urls: {
            success: "https://complexomelodia.com.br/confirmado",
            failure: "https://complexomelodia.com.br",
            pending: "https://complexomelodia.com.br"
          },
          auto_return: "approved",
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }]
          }
        })
      });
      const json = await resp.json();
      if (!json.init_point) return res.status(500).json({ error: "Link cartão não gerado", detalhes: json });
      return res.status(200).json({ initPoint: json.init_point });

    } else {
      // Pix → pagamento direto
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
      return res.status(200).json({
        pagamentoId: String(json.id),
        qrCode: pix.qr_code,
        qrCodeBase64: pix.qr_code_base64
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
