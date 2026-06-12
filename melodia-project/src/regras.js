// ============================================================
// REGRAS CENTRAIS DO COMPLEXO MELODIA
// Altere aqui para refletir automaticamente em todo o sistema
// ============================================================

export const REGRAS = {
  // Sauna
  SAUNA_PRECO_POR_PESSOA: 15, // R$ por pessoa

  // Quadra de Areia
  AREIA_PRECO_HORA: 60,         // R$/hora fixo até 12 pessoas
  AREIA_LIMITE_SEM_EXTRA: 12,   // até 12 pessoas = sem cobrança extra
  AREIA_PRECO_EXCEDENTE: 10,    // R$ por pessoa acima de 12, por hora completa

  // Campo Society — preços
  SOCIETY_PRECO_DIA: 120,       // R$/hora antes das 16h
  SOCIETY_PRECO_NOITE: 130,     // R$/hora a partir das 16h
  SOCIETY_HORA_NOITE: "16:00",  // horário que começa o preço noturno

  // Bloqueio de horário aguardando pagamento
  TIMEOUT_PAGAMENTO_MIN: 5,     // minutos para expirar reserva não paga
};

// Calcula excedentes da Areia
// Regra: apenas pessoas ACIMA de 12 pagam R$10/hora completa
export function calcExcedente(pessPresentes, duracaoMin) {
  const presentes = parseInt(pessPresentes) || 0;
  if (presentes <= REGRAS.AREIA_LIMITE_SEM_EXTRA) return 0;
  const excedentes = presentes - REGRAS.AREIA_LIMITE_SEM_EXTRA;
  const horas = Math.floor(duracaoMin / 60);
  if (horas < 1) return 0;
  return excedentes * REGRAS.AREIA_PRECO_EXCEDENTE * horas;
}

// Calcula valor da sauna
export function calcSauna(qtdPessoas) {
  const qtd = parseInt(qtdPessoas) || 0;
  return qtd * REGRAS.SAUNA_PRECO_POR_PESSOA;
}

// Calcula valor da Areia (R$60/h fixo até 12 pessoas, excedente é separado)
export function calcPrecoAreiaHora() {
  return REGRAS.AREIA_PRECO_HORA;
}

// Calcula preço do Society por hora
export function calcPrecoSocietyHora(horarioIni) {
  return horarioIni >= REGRAS.SOCIETY_HORA_NOITE
    ? REGRAS.SOCIETY_PRECO_NOITE
    : REGRAS.SOCIETY_PRECO_DIA;
}
