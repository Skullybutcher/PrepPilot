import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import todosRouter from './routes/todos.js';
import progressRouter from './routes/progress.js';
import boardRouter from './routes/board.js';
import planRouter from './routes/plan.js';
import rebalanceRouter from './routes/rebalance.js';
import userRouter from './routes/user.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/todos', todosRouter);
app.use('/api/progress', progressRouter);
app.use('/api/board', boardRouter);
app.use('/api/plan', planRouter);
app.use('/api/rebalance', rebalanceRouter);
app.use('/api/user', userRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));