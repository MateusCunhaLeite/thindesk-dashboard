// Valores fixos usados pela API (status, prioridades e setores).
// O SLA é o tempo máximo, em horas, para resolver um chamado de cada prioridade.

const STATUS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando usuário',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
};

const STATUS_PENDENTES = ['aberto', 'em_andamento', 'aguardando'];
const STATUS_CONCLUIDOS = ['resolvido', 'fechado'];

const PRIORIDADES = {
  baixa: { label: 'Baixa', slaHoras: 72 },
  media: { label: 'Média', slaHoras: 24 },
  alta: { label: 'Alta', slaHoras: 8 },
  critica: { label: 'Crítica', slaHoras: 4 },
};

const SETORES = [
  'Comercial',
  'Diretoria',
  'Financeiro',
  'Jurídico',
  'Logística',
  'Marketing',
  'RH',
  'TI',
];

// Trechos de SQL reaproveitados nas consultas
const sqlLista = (valores) => valores.map((v) => `'${v}'`).join(', ');

const SQL_PENDENTES = sqlLista(STATUS_PENDENTES);
const SQL_CONCLUIDOS = sqlLista(STATUS_CONCLUIDOS);

const SQL_SLA_HORAS = `(CASE c.prioridade ${Object.entries(PRIORIDADES)
  .map(([chave, p]) => `WHEN '${chave}' THEN ${p.slaHoras}`)
  .join(' ')} END)`;

// Horas entre a abertura e o fechamento (ou até agora, se ainda estiver aberto)
const SQL_HORAS_DECORRIDAS = `((julianday(COALESCE(c.data_fechamento, datetime('now', 'localtime'))) - julianday(c.data_abertura)) * 24)`;

module.exports = {
  STATUS,
  STATUS_PENDENTES,
  STATUS_CONCLUIDOS,
  PRIORIDADES,
  SETORES,
  SQL_PENDENTES,
  SQL_CONCLUIDOS,
  SQL_SLA_HORAS,
  SQL_HORAS_DECORRIDAS,
};
