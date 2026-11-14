const doisDigitos = (n) => String(n).padStart(2, '0');

// Formato usado no banco: "AAAA-MM-DD HH:MM:SS" (horário local)
function formatarData(data) {
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())} ` +
    `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`
  );
}

function formatarDia(data) {
  return formatarData(data).slice(0, 10);
}

function agora() {
  return formatarData(new Date());
}

// Aceita apenas datas no formato AAAA-MM-DD e que existam de verdade (ex: 2025-02-30 é inválida)
function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function paraData(texto) {
  const [ano, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

module.exports = { formatarData, formatarDia, agora, dataValida, paraData };
