import express from 'express';
import routes from './routes.js';

const app = express();

app.use(express.json());
app.use(routes);

app.listen(3001, () => {
  console.log('Bot Manager rodando na porta 3001');
});
