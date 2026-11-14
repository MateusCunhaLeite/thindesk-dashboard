const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { popularBanco } = require('./seed');

const CAMINHO_PADRAO = path.join(__dirname, '..', 'data', 'thindesk.db');

function criarTabelas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tecnicos (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      nome  TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      ativo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS chamados (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo           TEXT NOT NULL,
      descricao        TEXT,
      categoria_id     INTEGER NOT NULL REFERENCES categorias(id),
      prioridade       TEXT NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
      status           TEXT NOT NULL DEFAULT 'aberto'
                       CHECK (status IN ('aberto', 'em_andamento', 'aguardando', 'resolvido', 'fechado', 'cancelado')),
      solicitante      TEXT NOT NULL,
      setor            TEXT NOT NULL,
      tecnico_id       INTEGER REFERENCES tecnicos(id),
      data_abertura    TEXT NOT NULL,
      data_atualizacao TEXT,
      data_fechamento  TEXT
    );

    CREATE TABLE IF NOT EXISTS consideracoes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chamado_id    INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
      tecnico_id    INTEGER REFERENCES tecnicos(id),
      texto         TEXT NOT NULL,
      data_registro TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chamados_abertura   ON chamados (data_abertura);
    CREATE INDEX IF NOT EXISTS idx_chamados_fechamento ON chamados (data_fechamento);
    CREATE INDEX IF NOT EXISTS idx_chamados_status     ON chamados (status);
    CREATE INDEX IF NOT EXISTS idx_consideracoes_chamado ON consideracoes (chamado_id);
  `);
}

/**
 * Abre (ou cria) o banco SQLite. Se não houver nenhum chamado,
 * popula com dados de exemplo para o dashboard não ficar vazio.
 * Use ":memory:" nos testes.
 */
function abrirBanco(caminho = process.env.DB_PATH || CAMINHO_PADRAO) {
  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON;');
  criarTabelas(db);

  const { qtd } = db.prepare('SELECT COUNT(*) AS qtd FROM chamados').get();
  if (qtd === 0) {
    popularBanco(db);
  }

  return db;
}

module.exports = { abrirBanco, CAMINHO_PADRAO };
