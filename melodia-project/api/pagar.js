export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const PAGBANK_TOKEN = "38c03145-fb02-4054-903c-dce5d1392a95ebcbe6d747e1ad0490a1f0b8e17bced83753-8594-460c-90b2-09b6ecd7bc61";
  const dados = req.body;

  try {
    const resp = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAGBANK_TOKEN}`
      },
      body: JSON.stringify({
        reference_id: `${dados.quadraId}-${dados.data}-${dados.ini}-${Date.now()}`,
        customer: {
          name: dados.nome,
          email: "cliente@complexomelodia.com.br",
          tax_id: dados.cpf ? dados.cpf.replace(/\D/g,"").padEnd(11,"0").slice(0,11) : "00000000000",
          phones: [{
            country: "55",
            area: dados.tel.replace(/\D/g,"").slice(0,2),
            number: dados.tel.replace(/\D/g,"").slice(2,11),
            type: "MOBILE"
          }]
        },
        items: [{
          reference_id: dados.quadraId,
          name: `${dados.quadraNome} — ${dados.data} ${dados.ini}`,
          quantity: 1,
          unit_amount: Math.round(parseFloat(dados.valor) * 100)
        }],
        qr_codes: [{
          amount: { value: Math.round(parseFloat(dados.valor) * 100) },
          expiration_date: new Date(Date.now() + 30*60*1000).toISOString()
        }],
        charges: [{
          reference_id: `charge-${Date.now()}`,
          description: `Complexo Melodia — ${dados.quadraNome}`,
          amount: {
            value: Math.round(parseFloat(dados.valor) * 100),
            currency: "BRL"
          },
          payment_method: {
            type: "PIX",
            installments: 1,
            capture: true
          }
        }]
      })
    });

    const json = await resp.json();
    const link = json.links?.find(l => l.rel === "PAY")?.href;
    const qrCode = json.qr_codes?.[0];

    res.status(200).json({
      link: link || null,
      qr_code: qrCode?.text || null,
      qr_image: qrCode?.links?.find(l => l.media === "image/png")?.href || null
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
