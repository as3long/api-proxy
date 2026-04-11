import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

interface TokenRecord {
  timestamp: string;
  apiType: 'openai' | 'anthropic';
  route: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseTime: number;
  statusCode: number;
  isStream: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.csv');

function readTokenRecords(): TokenRecord[] {
  if (!fs.existsSync(TOKEN_FILE)) {
    return [];
  }
  const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  // Skip header
  return lines
    .slice(1)
    .map(line => {
      const values = line.split(',');
      return {
        timestamp: values[0] || '',
        apiType: (values[1] || 'openai') as 'openai' | 'anthropic',
        route: values[2] || '',
        model: values[3] || '',
        inputTokens: parseInt(values[4]) || 0,
        outputTokens: parseInt(values[5]) || 0,
        totalTokens: parseInt(values[6]) || 0,
        responseTime: parseInt(values[7]) || 0,
        statusCode: parseInt(values[8]) || 0,
        isStream: values[9] === 'true'
      };
    });
}

function calculateSummary(records: TokenRecord[]) {
  const totalRequests = records.length;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalResponseTime = 0;
  let successRequests = 0;

  const byApiType: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
  const byModel: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};

  records.forEach(r => {
    totalInputTokens += r.inputTokens;
    totalOutputTokens += r.outputTokens;
    totalTokens += r.totalTokens;
    totalResponseTime += r.responseTime;

    if (r.statusCode === 200) {
      successRequests++;
    }

    // By API type
    if (!byApiType[r.apiType]) {
      byApiType[r.apiType] = { count: 0, inputTokens: 0, outputTokens: 0 };
    }
    byApiType[r.apiType].count++;
    byApiType[r.apiType].inputTokens += r.inputTokens;
    byApiType[r.apiType].outputTokens += r.outputTokens;

    // By model
    if (r.model) {
      if (!byModel[r.model]) {
        byModel[r.model] = { count: 0, inputTokens: 0, outputTokens: 0 };
      }
      byModel[r.model].count++;
      byModel[r.model].inputTokens += r.inputTokens;
      byModel[r.model].outputTokens += r.outputTokens;
    }
  });

  return {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
    successRate: totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100) : 0,
    byApiType,
    byModel
  };
}

// 获取统计数据
router.get('/token-stats/data', (req, res) => {
  const records = readTokenRecords();
  const summary = calculateSummary(records);

  // 返回最近 100 条记录
  const recentRecords = records.slice(-100).reverse();

  res.json({
    records: recentRecords,
    summary
  });
});

// 清空统计数据
router.post('/token-stats/clear', (req, res) => {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
  res.json({ success: true });
});

export default router;