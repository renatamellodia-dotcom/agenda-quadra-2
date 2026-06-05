export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const MP_ACCESS_TOKEN = "APP_USR-6072226638550144-060413-d83b1b373f8d5638dcd1391941826a23-237821225";
  const dados = req.body;

  try {
    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          title: `Complexo Melodia — ${dados.quadraNome} ${dados.data} ${dados.ini}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: parseFloat(dados.valor)
        }],
        payer: {
          name: dados.nome,
          phone: {
            area_code: (dados.tel||"").replace(/\D/g,"").slice(0,2),
            number: (dados.tel||"").replace(/\D/g,"").slice(2)
          }
        },
        payment_methods: {
          default_payment_method_id: "pix"
        },
        back_urls: {
          success: "https://complexomelodia.com.br/confirmado",
          failure: "https://complexomelodia.com.br",
          pending: "https://complexomelodia.com.br"
        },
        auto_return: "approved",
        notification_url: "https://complexomelodia.com.br/api/webhook",
        external_reference: dados.extRef || `${dados.quadraId}-${Date.now()}`
      })
    });

    const json = await resp.json();
    res.status(200).json({ init_point: json.init_point });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
