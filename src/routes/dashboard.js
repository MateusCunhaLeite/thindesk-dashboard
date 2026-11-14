const express = require('express');
const { montarFiltros, inteiroPositivo } = require('../utils/filtros');
const { ErroValidacao } = require('../utils/erros');
const { formatarDia, paraData } = require('../utils/datas');
const {
  STATUS,
  PRIORIDADES,
  SQL_PENDENTES,
  SQL_CONCLUIDOS,
  SQL_SLA_HORAS,
  SQL_HORAS_DECORRIDAS,
} = require('../constantes');

const arredondar = (valor, casas = 1) => (valor == null ? null : Number(valor.toFixed(casas)));
const percentual = (parte, total) => (total > 0 ? arredondar((parte / total) * 100) : 0);

// Como agrupar as datas em cada tipo de agrupamento.
// Na semana usamos a data da segunda-feira como chave.
const AGRUPAMENTOS = {
  dia: (coluna) => `date(${coluna})`,
  semana: (coluna) => `date(${coluna}, 'weekday 0', '-6 days')`,
  mes: (coluna) => `strftime('%Y-%m', ${coluna})`,
};

function proximoPeriodo(data, agrupamento) {
  const nova = new Date(data);
  if (agrupamento === 'dia') nova.setDate(nova.getDate() + 1);
  if (agrupamento === 'semana') nova.setDate(nova.getDate() + 7);
  if (agrupamento === 'mes') nova.setMonth(nova.getMonth() + 1);
  return nova;
}

function inicioDoPeriodo(data, agrupamento) {
  const nova = new Date(data);
  if (agrupamento === 'semana') {
    const diaSemana = (nova.getDay() + 6) % 7; // segunda = 0
    nova.setDate(nova.getDate() - diaSemana);
  }
  if (agrupamento === 'mes') nova.setDate(1);
  return nova;
}

const chaveDoPeriodo = (data, agrupamento) =>
  agrupamento === 'mes' ? formatarDia(data).slice(0, 7) : formatarDia(data);

// Preenche os períodos sem nenhum chamado com zero, senão o gráfico "pula" datas
function preencherLacunas(mapa, inicio, fim, agrupamento) {
  const resultado = [];
  let atual = inicioDoPeriodo(paraData(inicio), agrupamento);
  const limite = paraData(fim);

  while (atual <= limite) {
    const chave = chaveDoPeriodo(atual, agrupamento);
    resultado.push(mapa.get(chave) || { periodo: chave, abertos: 0, resolvidos: 0 });
    atual = proximoPeriodo(atual, agrupamento);
  }
  return resultado;
}

function rotasDashboard(db) {
  const router = express.Router();

  // RF01 - Indicadores gerais
  router.get('/indicadores', (req, res) => {
    const { where, params } = montarFiltros(req.query);

    const linha = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          COALESCE(SUM(c.status = 'aberto'), 0)       AS abertos,
          COALESCE(SUM(c.status = 'em_andamento'), 0) AS em_andamento,
          COALESCE(SUM(c.status = 'aguardando'), 0)   AS aguardando,
          COALESCE(SUM(c.status = 'resolvido'), 0)    AS resolvidos,
          COALESCE(SUM(c.status = 'fechado'), 0)      AS fechados,
          COALESCE(SUM(c.status = 'cancelado'), 0)    AS cancelados,
          COALESCE(SUM(c.tecnico_id IS NULL AND c.status IN (${SQL_PENDENTES})), 0) AS sem_tecnico,
          COALESCE(SUM(c.status IN (${SQL_PENDENTES}) AND ${SQL_HORAS_DECORRIDAS} > ${SQL_SLA_HORAS}), 0) AS atrasados,
          COALESCE(SUM(c.status IN (${SQL_CONCLUIDOS}) AND ${SQL_HORAS_DECORRIDAS} <= ${SQL_SLA_HORAS}), 0) AS concluidos_no_prazo,
          AVG(CASE WHEN c.status IN (${SQL_CONCLUIDOS}) THEN ${SQL_HORAS_DECORRIDAS} END) AS tempo_medio_horas
        FROM chamados c
        ${where}`
      )
      .get(params);

    const pendentes = linha.abertos + linha.em_andamento + linha.aguardando;
    const concluidos = linha.resolvidos + linha.fechados;
    const validos = linha.total - linha.cancelados; // cancelados não entram na taxa de resolução

    res.json({
      total: linha.total,
      pendentes,
      abertos: linha.abertos,
      emAndamento: linha.em_andamento,
      aguardando: linha.aguardando,
      concluidos,
      resolvidos: linha.resolvidos,
      fechados: linha.fechados,
      cancelados: linha.cancelados,
      semTecnico: linha.sem_tecnico,
      atrasados: linha.atrasados,
      taxaResolucao: percentual(concluidos, validos),
      percentualNoPrazo: percentual(linha.concluidos_no_prazo, concluidos),
      tempoMedioResolucaoHoras: arredondar(linha.tempo_medio_horas),
    });
  });

  // RF02 - Chamados abertos x resolvidos por período
  router.get('/por-periodo', (req, res) => {
    const agrupamento = req.query.agrupamento || 'dia';
    if (!AGRUPAMENTOS[agrupamento]) {
      throw new ErroValidacao('Agrupamento inválido. Use: dia, semana ou mes');
    }

    const abertura = montarFiltros(req.query, { colunaData: 'c.data_abertura' });
    const fechamento = montarFiltros(req.query, { colunaData: 'c.data_fechamento' });
    const condicaoFechamento = `c.data_fechamento IS NOT NULL AND c.status IN (${SQL_CONCLUIDOS})`;

    const abertos = db
      .prepare(
        `SELECT ${AGRUPAMENTOS[agrupamento]('c.data_abertura')} AS periodo, COUNT(*) AS qtd
         FROM chamados c ${abertura.where}
         GROUP BY periodo`
      )
      .all(abertura.params);

    const resolvidos = db
      .prepare(
        `SELECT ${AGRUPAMENTOS[agrupamento]('c.data_fechamento')} AS periodo, COUNT(*) AS qtd
         FROM chamados c
         ${fechamento.where ? `${fechamento.where} AND` : 'WHERE'} ${condicaoFechamento}
         GROUP BY periodo`
      )
      .all(fechamento.params);

    const mapa = new Map();
    const pegar = (periodo) => {
      if (!mapa.has(periodo)) mapa.set(periodo, { periodo, abertos: 0, resolvidos: 0 });
      return mapa.get(periodo);
    };
    abertos.forEach((l) => (pegar(l.periodo).abertos = l.qtd));
    resolvidos.forEach((l) => (pegar(l.periodo).resolvidos = l.qtd));

    const chaves = [...mapa.keys()].sort();
    if (!chaves.length) {
      return res.json({ agrupamento, dados: [] });
    }

    const inicio = req.query.inicio || (agrupamento === 'mes' ? `${chaves[0]}-01` : chaves[0]);
    const fim = req.query.fim || formatarDia(new Date());

    const totalDias = (paraData(fim) - paraData(inicio)) / 86400000;
    if (agrupamento === 'dia' && totalDias > 366) {
      throw new ErroValidacao('Para períodos maiores que 1 ano use o agrupamento por semana ou mês');
    }

    res.json({ agrupamento, dados: preencherLacunas(mapa, inicio, fim, agrupamento) });
  });

  // RF03 - Situação dos chamados (quantidade por status)
  router.get('/por-status', (req, res) => {
    const { where, params } = montarFiltros(req.query);
    const linhas = db
      .prepare(`SELECT c.status, COUNT(*) AS total FROM chamados c ${where} GROUP BY c.status`)
      .all(params);

    const totais = Object.fromEntries(linhas.map((l) => [l.status, l.total]));
    res.json(
      Object.entries(STATUS).map(([status, label]) => ({ status, label, total: totais[status] || 0 }))
    );
  });

  router.get('/por-prioridade', (req, res) => {
    const { where, params } = montarFiltros(req.query);
    const linhas = db
      .prepare(
        `SELECT c.prioridade,
                COUNT(*) AS total,
                COALESCE(SUM(c.status IN (${SQL_PENDENTES})), 0) AS pendentes,
                COALESCE(SUM(c.status IN (${SQL_PENDENTES}) AND ${SQL_HORAS_DECORRIDAS} > ${SQL_SLA_HORAS}), 0) AS atrasados
         FROM chamados c ${where}
         GROUP BY c.prioridade`
      )
      .all(params);

    const porChave = Object.fromEntries(linhas.map((l) => [l.prioridade, l]));
    res.json(
      Object.entries(PRIORIDADES).map(([prioridade, info]) => ({
        prioridade,
        label: info.label,
        slaHoras: info.slaHoras,
        total: porChave[prioridade]?.total || 0,
        pendentes: porChave[prioridade]?.pendentes || 0,
        atrasados: porChave[prioridade]?.atrasados || 0,
      }))
    );
  });

  // RF04 - Tipos de chamados mais atendidos
  router.get('/por-categoria', (req, res) => {
    const { where, params } = montarFiltros(req.query);
    const limite = req.query.limite ? inteiroPositivo(req.query.limite, 'limite') : 10;

    const linhas = db
      .prepare(
        `SELECT cat.id, cat.nome,
                COUNT(*) AS total,
                COALESCE(SUM(c.status IN (${SQL_CONCLUIDOS})), 0) AS atendidos,
                COALESCE(SUM(c.status IN (${SQL_PENDENTES})), 0) AS pendentes,
                AVG(CASE WHEN c.status IN (${SQL_CONCLUIDOS}) THEN ${SQL_HORAS_DECORRIDAS} END) AS tempo_medio
         FROM chamados c
         JOIN categorias cat ON cat.id = c.categoria_id
         ${where}
         GROUP BY cat.id
         ORDER BY atendidos DESC, total DESC
         LIMIT :limite`
      )
      .all({ ...params, limite });

    // participação calculada sobre todos os chamados filtrados, não só os do ranking
    const { totalGeral } = db.prepare(`SELECT COUNT(*) AS totalGeral FROM chamados c ${where}`).get(params);
    res.json(
      linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        total: l.total,
        atendidos: l.atendidos,
        pendentes: l.pendentes,
        participacao: percentual(l.total, totalGeral),
        tempoMedioHoras: arredondar(l.tempo_medio),
      }))
    );
  });

  // Ranking de técnicos (complementa o RF04 com a visão de quem atende)
  router.get('/por-tecnico', (req, res) => {
    const { where, params } = montarFiltros(req.query);

    const linhas = db
      .prepare(
        `SELECT t.id, t.nome,
                COUNT(*) AS total,
                COALESCE(SUM(c.status IN (${SQL_CONCLUIDOS})), 0) AS atendidos,
                COALESCE(SUM(c.status IN (${SQL_PENDENTES})), 0) AS pendentes,
                COALESCE(SUM(c.status IN (${SQL_CONCLUIDOS}) AND ${SQL_HORAS_DECORRIDAS} <= ${SQL_SLA_HORAS}), 0) AS no_prazo,
                AVG(CASE WHEN c.status IN (${SQL_CONCLUIDOS}) THEN ${SQL_HORAS_DECORRIDAS} END) AS tempo_medio
         FROM chamados c
         JOIN tecnicos t ON t.id = c.tecnico_id
         ${where}
         GROUP BY t.id
         ORDER BY atendidos DESC`
      )
      .all(params);

    res.json(
      linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        total: l.total,
        atendidos: l.atendidos,
        pendentes: l.pendentes,
        percentualNoPrazo: percentual(l.no_prazo, l.atendidos),
        tempoMedioHoras: arredondar(l.tempo_medio),
      }))
    );
  });

  return router;
}

module.exports = rotasDashboard;
