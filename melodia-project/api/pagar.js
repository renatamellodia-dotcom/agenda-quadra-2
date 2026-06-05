export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  if (req.method !== "POST") return res.status(405).end();

  const PAGBANK_TOKEN = "38c03145-fb02-4054-903c-dce5d1392a95ebcbe6d747e1ad0490a1f0b8e17bced83753-8594-460c-90b2-09b6ecd7bc61";
  const dados = req.body;

  try {
    const valor = Math.round(parseFloat(dados.valor) * 100);
    const tel = (dados.tel || "").replace(/\D/g, "");
    const cpf = (dados.cpf || "00000000000").replace(/\D/g, "").padEnd(11,"0").slice(0,11);

    const body = {
      reference_id: `${dados.quadraId}-${dados.data}-${dados.ini}-${Date.now()}`,
      customer: {
        name: dados.nome || "Cliente",
        email: "reserva@complexomelodia.com.br",
        tax_id: cpf,
        phones: [{
          country: "55",
          area: tel.slice(0,2) || "22",
          number: tel.slice(2,11) || "999999999",
          type: "MOBILE"
        }]
      },
      items: [{
        reference_id: dados.quadraId,
        name: `${dados.quadraNome} - ${dados.data} ${dados.ini}`,
        quantity: 1,
        unit_amount: valor
      }],
      qr_codes: [{
        amount: { value: valor },
        expiration_date: new Date(Date.now() + 30*60*1000).toISOString()
      }],
      charges: [{
        reference_id: `charge-${Date.now()}`,
        description: `Complexo Melodia - ${dados.quadraNome}`,
        amount: { value: valor, currency: "BRL" },
        payment_method: { type: "PIX", installments: 1, capture: true }
      }]
    };

    const resp = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAGBANK_TOKEN}`
      },
      body: JSON.stringify(body)
    });

    const json = await resp.json();
    const link = json.links?.find(l => l.rel === "PAY")?.href || null;
    const qrCode = json.qr_codes?.[0]?.text || null;

    res.status(200).json({ link, qrCode });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
