const express = require('express');
const { STATUS, PRIORIDADES, SETORES } = require('../constantes');

// Valores disponíveis para montar os filtros do dashboard (RF05)
function rotasOpcoes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const categorias = db.prepare('SELECT id, nome FROM categorias ORDER BY nome').all();
    const tecnicos = db.prepare('SELECT id, nome FROM tecnicos WHERE ativo = 1 ORDER BY nome').all();
    const periodo = db
      .prepare('SELECT date(MIN(data_abertura)) AS inicio, date(MAX(data_abertura)) AS fim FROM chamados')
      .get();

    res.json({
      status: Object.entries(STATUS).map(([valor, label]) => ({ valor, label })),
      prioridades: Object.entries(PRIORIDADES).map(([valor, p]) => ({ valor, label: p.label, slaHoras: p.slaHoras })),
      setores: SETORES,
      categorias,
      tecnicos,
      periodo,
    });
  });

  return router;
}

module.exports = rotasOpcoes;
