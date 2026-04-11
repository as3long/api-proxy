import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config';
import chatRoutes from './routes/chat';
import anthropicRoutes from './routes/anthropic';
import statsRoutes from './routes/stats';
import { tokenStatsMiddleware } from './middleware/token-stats';

// 简单的日志中间件
const logger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

// 创建Express应用
const app = express();

// 中间件
app.use(logger);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(tokenStatsMiddleware);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API路由
app.use('/v1/chat', chatRoutes);
app.use('/v1', anthropicRoutes);
app.use(statsRoutes);

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      type: 'not_found_error',
      code: 'not_found'
    }
  });
});

// 启动服务器
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
  console.log(`API endpoint: http://localhost:${config.port}/v1/chat/completions`);
  console.log(`API endpoint: http://localhost:${config.port}/v1/messages`);
});