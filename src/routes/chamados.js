const express = require('express');
const { montarFiltros, inteiroPositivo } = require('../utils/filtros');
const { ErroValidacao, NaoEncontrado } = require('../utils/erros');
const { agora } = require('../utils/datas');
const {
  STATUS,
  STATUS_PENDENTES,
  STATUS_CONCLUIDOS,
  PRIORIDADES,
  SETORES,
  SQL_SLA_HORAS,
  SQL_HORAS_DECORRIDAS,
} = require('../constantes');

const CAMPOS_LISTAGEM = `
  c.id, c.titulo, c.status, c.prioridade, c.solicitante, c.setor,
  c.categoria_id, cat.nome AS categoria,
  c.tecnico_id, t.nome AS tecnico,
  c.data_abertura, c.data_atualizacao, c.data_fechamento,
  ROUND(${SQL_HORAS_DECORRIDAS}, 1) AS horas_decorridas,
  ${SQL_SLA_HORAS} AS sla_horas
`;

const JOINS = `
  FROM chamados c
  JOIN categorias cat ON cat.id = c.categoria_id
  LEFT JOIN tecnicos t ON t.id = c.tecnico_id
`;

// Campo calculado: passou do SLA? (cancelados não contam)
function comPrazo(chamado) {
  return {
    ...chamado,
    foraDoPrazo: chamado.status !== 'cancelado' && chamado.horas_decorridas > chamado.sla_horas,
  };
}

function textoObrigatorio(valor, campo, max) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new ErroValidacao(`O campo "${campo}" é obrigatório`);
  }
  if (valor.trim().length > max) {
    throw new ErroValidacao(`O campo "${campo}" deve ter no máximo ${max} caracteres`);
  }
  return valor.trim();
}

function rotasChamados(db) {
  const router = express.Router();

  const existeTecnico = (id) => db.prepare('SELECT 1 FROM tecnicos WHERE id = ?').get(id);
  const existeCategoria = (id) => db.prepare('SELECT 1 FROM categorias WHERE id = ?').get(id);

  function buscarChamado(id) {
    const chamado = db.prepare(`SELECT ${CAMPOS_LISTAGEM}, c.descricao ${JOINS} WHERE c.id = ?`).get(id);
    if (!chamado) throw new NaoEncontrado(`Chamado #${id} não encontrado`);
    return chamado;
  }

  // Listagem paginada com os mesmos filtros do dashboard
  router.get('/', (req, res) => {
    const pagina = req.query.pagina ? inteiroPositivo(req.query.pagina, 'pagina') : 1;
    const limite = Math.min(req.query.limite ? inteiroPositivo(req.query.limite, 'limite') : 10, 100);
    const { where, params } = montarFiltros(req.query);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM chamados c ${where}`).get(params);

    const dados = db
      .prepare(
        `SELECT ${CAMPOS_LISTAGEM} ${JOINS} ${where}
         ORDER BY c.data_abertura DESC
         LIMIT :limite OFFSET :offset`
      )
      .all({ ...params, limite, offset: (pagina - 1) * limite })
      .map(comPrazo);

    res.json({
      dados,
      pagina,
      limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    });
  });

  // Detalhe do chamado com as considerações técnicas
  router.get('/:id', (req, res) => {
    const id = inteiroPositivo(req.params.id, 'id');
    const chamado = buscarChamado(id);

    const consideracoes = db
      .prepare(
        `SELECT co.id, co.texto, co.data_registro, co.tecnico_id, t.nome AS tecnico
         FROM consideracoes co
         LEFT JOIN tecnicos t ON t.id = co.tecnico_id
         WHERE co.chamado_id = ?
         ORDER BY co.data_registro, co.id`
      )
      .all(id);

    res.json({ ...comPrazo(chamado), consideracoes });
  });

  // Abertura de chamado
  router.post('/', (req, res) => {
    const corpo = req.body || {};
    const titulo = textoObrigatorio(corpo.titulo, 'titulo', 120);
    const solicitante = textoObrigatorio(corpo.solicitante, 'solicitante', 80);
    const descricao = typeof corpo.descricao === 'string' ? corpo.descricao.trim().slice(0, 2000) : null;

    const categoriaId = inteiroPositivo(corpo.categoria_id, 'categoria_id');
    if (!existeCategoria(categoriaId)) throw new ErroValidacao('Categoria não encontrada');

    const prioridade = corpo.prioridade || 'media';
    if (!PRIORIDADES[prioridade]) throw new ErroValidacao('Prioridade inválida');

    if (!SETORES.includes(corpo.setor)) throw new ErroValidacao('Setor inválido');

    const momento = agora();
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO chamados (titulo, descricao, categoria_id, prioridade, status, solicitante, setor, data_abertura, data_atualizacao)
         VALUES (?, ?, ?, ?, 'aberto', ?, ?, ?, ?)`
      )
      .run(titulo, descricao, categoriaId, prioridade, solicitante, corpo.setor, momento, momento);

    res.status(201).json(comPrazo(buscarChamado(Number(lastInsertRowid))));
  });

  // Atualização de status, técnico responsável e prioridade
  router.patch('/:id', (req, res) => {
    const id = inteiroPositivo(req.params.id, 'id');
    const atual = buscarChamado(id);
    const corpo = req.body || {};

    const campos = [];
    const valores = [];

    if (corpo.status !== undefined) {
      if (!STATUS[corpo.status]) throw new ErroValidacao('Status inválido');
      campos.push('status = ?');
      valores.push(corpo.status);

      // controla a data de fechamento conforme a mudança de status
      const estavaEncerrado = !STATUS_PENDENTES.includes(atual.status);
      const vaiEncerrar = STATUS_CONCLUIDOS.includes(corpo.status) || corpo.status === 'cancelado';
      if (vaiEncerrar && !estavaEncerrado) {
        campos.push('data_fechamento = ?');
        valores.push(agora());
      } else if (!vaiEncerrar) {
        campos.push('data_fechamento = NULL');
      }
    }

    if (corpo.tecnico_id !== undefined) {
      if (corpo.tecnico_id === null) {
        campos.push('tecnico_id = NULL');
      } else {
        const tecnicoId = inteiroPositivo(corpo.tecnico_id, 'tecnico_id');
        if (!existeTecnico(tecnicoId)) throw new ErroValidacao('Técnico não encontrado');
        campos.push('tecnico_id = ?');
        valores.push(tecnicoId);
      }
    }

    if (corpo.prioridade !== undefined) {
      if (!PRIORIDADES[corpo.prioridade]) throw new ErroValidacao('Prioridade inválida');
      campos.push('prioridade = ?');
      valores.push(corpo.prioridade);
    }

    if (!campos.length) {
      throw new ErroValidacao('Informe ao menos um campo para atualizar (status, tecnico_id ou prioridade)');
    }

    campos.push('data_atualizacao = ?');
    valores.push(agora());

    db.prepare(`UPDATE chamados SET ${campos.join(', ')} WHERE id = ?`).run(...valores, id);
    res.json(comPrazo(buscarChamado(id)));
  });

  // Registro de consideração técnica
  router.post('/:id/consideracoes', (req, res) => {
    const id = inteiroPositivo(req.params.id, 'id');
    buscarChamado(id);

    const corpo = req.body || {};
    const texto = textoObrigatorio(corpo.texto, 'texto', 1000);

    let tecnicoId = null;
    if (corpo.tecnico_id !== undefined && corpo.tecnico_id !== null && corpo.tecnico_id !== '') {
      tecnicoId = inteiroPositivo(corpo.tecnico_id, 'tecnico_id');
      if (!existeTecnico(tecnicoId)) throw new ErroValidacao('Técnico não encontrado');
    }

    const momento = agora();
    const { lastInsertRowid } = db
      .prepare('INSERT INTO consideracoes (chamado_id, tecnico_id, texto, data_registro) VALUES (?, ?, ?, ?)')
      .run(id, tecnicoId, texto, momento);
    db.prepare('UPDATE chamados SET data_atualizacao = ? WHERE id = ?').run(momento, id);

    const consideracao = db
      .prepare(
        `SELECT co.id, co.texto, co.data_registro, co.tecnico_id, t.nome AS tecnico
         FROM consideracoes co LEFT JOIN tecnicos t ON t.id = co.tecnico_id
         WHERE co.id = ?`
      )
      .get(lastInsertRowid);

    res.status(201).json(consideracao);
  });

  return router;
}

module.exports = rotasChamados;
