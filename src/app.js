const path = require('node:path');
const express = require('express');
const rotasDashboard = require('./routes/dashboard');
const rotasChamados = require('./routes/chamados');
const rotasOpcoes = require('./routes/opcoes');
const { tratarErros } = require('./utils/erros');

function criarApp(db) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', horario: new Date().toISOString() });
  });

  app.use('/api/opcoes', rotasOpcoes(db));
  app.use('/api/dashboard', rotasDashboard(db));
  app.use('/api/chamados', rotasChamados(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não encontrada` });
  });

  app.use(tratarErros);

  return app;
}

module.exports = { criarApp };
