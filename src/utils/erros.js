class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.status = 400;
  }
}

class NaoEncontrado extends Error {
  constructor(mensagem = 'Registro não encontrado') {
    super(mensagem);
    this.status = 404;
  }
}

// Middleware final do Express: transforma qualquer erro em uma resposta JSON
function tratarErros(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ erro: err.message });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ erro: 'Erro interno no servidor' });
}

module.exports = { ErroValidacao, NaoEncontrado, tratarErros };
