// Funções de formatação usadas na tela (RF07 - tratamento dos dados)

const fmt = {
  numero(valor) {
    return valor == null ? '-' : Number(valor).toLocaleString('pt-BR');
  },

  percentual(valor) {
    return valor == null ? '-' : `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  },

  // 27.5 -> "1d 3h" | 3.2 -> "3h 12min" | 0.4 -> "24min"
  horas(valor) {
    if (valor == null || Number.isNaN(Number(valor))) return '-';
    const totalMin = Math.round(Number(valor) * 60);
    const dias = Math.floor(totalMin / 1440);
    const horas = Math.floor((totalMin % 1440) / 60);
    const minutos = totalMin % 60;

    if (dias > 0) return horas ? `${dias}d ${horas}h` : `${dias}d`;
    if (horas > 0) return minutos ? `${horas}h ${minutos}min` : `${horas}h`;
    return `${minutos}min`;
  },

  // "2026-11-13 14:05:00" -> "13/11/2026 14:05"
  dataHora(texto) {
    if (!texto) return '-';
    const [data, hora = ''] = texto.split(' ');
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano} ${hora.slice(0, 5)}`.trim();
  },

  // rótulo do eixo X conforme o agrupamento do gráfico
  periodo(chave, agrupamento) {
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const [ano, mes, dia] = chave.split('-');
    if (agrupamento === 'mes') return `${meses[Number(mes) - 1]}/${ano.slice(2)}`;
    if (agrupamento === 'semana') return `sem. ${dia}/${mes}`;
    return `${dia}/${mes}`;
  },

  // data local no formato do input type="date"
  diaISO(data) {
    const p = (n) => String(n).padStart(2, '0');
    return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
  },

  escapar(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
