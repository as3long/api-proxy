import express from 'express';
import { getTokenStatsSummaryFlatBufferAsync, clearTokenRecordsFlatBufferAsync } from '../middleware/token-stats-flatbuffer';

const router = express.Router();

// 获取统计数据
router.get('/token-stats/data', async (req, res) => {
  const stats = await getTokenStatsSummaryFlatBufferAsync();
  
  // 计算成功率（简化版，实际应该在保存记录时统计）
  const successRate = stats.totalRequests > 0 ? 100 : 0;
  
  // 转换数据格式以匹配原有接口
  const byApiType: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
  for (const [apiType, apiStats] of Object.entries(stats.apiTypeStats)) {
    byApiType[apiType] = {
      count: apiStats.count,
      inputTokens: apiStats.inputTokens,
      outputTokens: apiStats.outputTokens
    };
  }
  
  const byModel: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
  for (const [model, modelStats] of Object.entries(stats.modelStats)) {
    byModel[model] = {
      count: modelStats.count,
      inputTokens: modelStats.inputTokens,
      outputTokens: modelStats.outputTokens
    };
  }

  res.json({
    records: stats.recentRequests,
    summary: {
      totalRequests: stats.totalRequests,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalTokens: stats.totalTokens,
      avgResponseTime: stats.averageResponseTime,
      successRate,
      byApiType,
      byModel
    }
  });
});

// 清空统计数据
router.post('/token-stats/clear', async (req, res) => {
  await clearTokenRecordsFlatBufferAsync();
  res.json({ success: true });
});

export default router;