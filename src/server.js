const { abrirBanco } = require('./db');
const { criarApp } = require('./app');

const PORTA = process.env.PORT || 3000;

const db = abrirBanco();
const app = criarApp(db);

app.listen(PORTA, () => {
  console.log(`Thindesk rodando em http://localhost:${PORTA}`);
});
