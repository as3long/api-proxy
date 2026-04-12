import * as flatbuffers from 'flatbuffers';
import fs from 'fs';
import path from 'path';
import { TokenRecord } from '../token-stats/token-record';

interface TokenRecordData {
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
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.bin');
const SUMMARY_FILE = path.join(DATA_DIR, 'token-summary.json');
const MAX_RECENT_RECORDS = 20;

interface TokenSummaryData {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalResponseTime: number;
  byApiType: {
    openai: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      tokens: number;
    };
    anthropic: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      tokens: number;
    };
  };
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
  }>;
  updatedAt: string;
  recentRecordsOffsets: { offset: number; size: number }[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 初始化摘要数据
function initializeSummary(): TokenSummaryData {
  return {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalResponseTime: 0,
    byApiType: {
      openai: { requests: 0, inputTokens: 0, outputTokens: 0, tokens: 0 },
      anthropic: { requests: 0, inputTokens: 0, outputTokens: 0, tokens: 0 }
    },
    byModel: {},
    updatedAt: new Date().toISOString(),
    recentRecordsOffsets: []
  };
}

// 读取摘要数据
function readSummary(): TokenSummaryData {
  if (!fs.existsSync(SUMMARY_FILE)) {
    return initializeSummary();
  }
  
  try {
    const buffer = fs.readFileSync(SUMMARY_FILE);
    return JSON.parse(buffer.toString());
  } catch (e) {
    return initializeSummary();
  }
}

// 异步保存摘要数据
async function saveSummaryAsync(summary: TokenSummaryData) {
  ensureDataDir();
  await fs.promises.writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2));
}



// 从tokens.bin文件读取最近的记录
async function readRecentRecordsFromOffsetsAsync(): Promise<TokenRecordData[]> {
  if (!fs.existsSync(TOKEN_FILE)) {
    return [];
  }
  
  try {
    // 读取摘要，获取最近记录的偏移量
    const summary = readSummary();
    const recentOffsets = summary.recentRecordsOffsets || [];
    
    if (recentOffsets.length === 0) {
      return [];
    }
    
    const records: TokenRecordData[] = [];
    const fd = await fs.promises.open(TOKEN_FILE, 'r');
    
    try {
      for (const { offset, size } of recentOffsets) {
        // 读取记录数据
        const buffer = Buffer.alloc(size);
        await fd.read(buffer, 0, size, offset);
        
        // 解析记录
        const byteBuffer = new flatbuffers.ByteBuffer(buffer);
        const tokenRecord = TokenRecord.getSizePrefixedRootAsTokenRecord(byteBuffer);
        
        const record: TokenRecordData = {
          timestamp: tokenRecord.timestamp() || '',
          apiType: (tokenRecord.apiType() as 'openai' | 'anthropic') || 'openai',
          route: tokenRecord.route() || '',
          model: tokenRecord.model() || '',
          inputTokens: Number(tokenRecord.inputTokens()),
          outputTokens: Number(tokenRecord.outputTokens()),
          totalTokens: Number(tokenRecord.totalTokens()),
          responseTime: Number(tokenRecord.responseTime()),
          statusCode: tokenRecord.statusCode(),
          isStream: tokenRecord.isStream()
        };
        
        records.push(record);
      }
    } finally {
      await fd.close();
    }
    
    return records;
  } catch (e) {
    console.error('Error reading recent records from offsets:', e);
    return [];
  }
}

// 更新摘要数据
function updateSummary(summary: TokenSummaryData, record: TokenRecordData): TokenSummaryData {
  // 更新总统计
  summary.totalRequests += 1;
  summary.totalInputTokens += record.inputTokens;
  summary.totalOutputTokens += record.outputTokens;
  summary.totalTokens += record.totalTokens;
  summary.totalResponseTime += record.responseTime;
  summary.updatedAt = new Date().toISOString();
  
  // 更新按API类型统计
  summary.byApiType[record.apiType].requests += 1;
  summary.byApiType[record.apiType].inputTokens += record.inputTokens;
  summary.byApiType[record.apiType].outputTokens += record.outputTokens;
  summary.byApiType[record.apiType].tokens += record.totalTokens;
  
  // 更新按模型统计
  if (!summary.byModel[record.model]) {
    summary.byModel[record.model] = {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokens: 0
    };
  }
  summary.byModel[record.model].requests += 1;
  summary.byModel[record.model].inputTokens += record.inputTokens;
  summary.byModel[record.model].outputTokens += record.outputTokens;
  summary.byModel[record.model].tokens += record.totalTokens;
  
  return summary;
}

/**
 * 异步将Token记录保存为flatbuffer格式
 */
export async function saveTokenRecordFlatBufferAsync(record: TokenRecordData): Promise<void> {
  ensureDataDir();
  
  // 获取文件当前大小，作为新记录的偏移量
  let fileSize = 0;
  try {
    const stats = await fs.promises.stat(TOKEN_FILE);
    fileSize = stats.size;
  } catch (e) {
    // 文件不存在，偏移量为0
  }
  
  // 创建FlatBuffer builder
  const builder = new flatbuffers.Builder(1024);
  
  // 写入字符串字段
  const timestampOffset = builder.createString(record.timestamp);
  const apiTypeOffset = builder.createString(record.apiType);
  const routeOffset = builder.createString(record.route);
  const modelOffset = builder.createString(record.model);
  
  // 创建TokenRecord
  const tokenRecordOffset = TokenRecord.createTokenRecord(
    builder,
    timestampOffset,
    apiTypeOffset,
    routeOffset,
    modelOffset,
    BigInt(record.inputTokens),
    BigInt(record.outputTokens),
    BigInt(record.totalTokens),
    BigInt(record.responseTime),
    record.statusCode,
    record.isStream
  );
  
  // 完成构建
  builder.finishSizePrefixed(tokenRecordOffset);
  
  // 获取字节数组
  const buffer = builder.asUint8Array();
  
  // 计算记录大小（包括大小前缀）
  const recordSize = buffer.length;
  
  // 异步追加写入
  await fs.promises.appendFile(TOKEN_FILE, buffer);
  
  // 更新统计摘要
  const summary = readSummary();
  const updatedSummary = updateSummary(summary, record);
  
  // 更新最近记录偏移量
  const recentOffsets = [...(updatedSummary.recentRecordsOffsets || [])];
  recentOffsets.push({ offset: fileSize, size: recordSize });
  // 只保留最近20条
  if (recentOffsets.length > MAX_RECENT_RECORDS) {
    recentOffsets.shift();
  }
  updatedSummary.recentRecordsOffsets = recentOffsets;
  
  await saveSummaryAsync(updatedSummary);
}

/**
 * 异步清空Token记录
 */
export async function clearTokenRecordsFlatBufferAsync(): Promise<void> {
  try {
    await fs.promises.unlink(TOKEN_FILE);
  } catch (e) {
    // 文件不存在，忽略错误
  }
  try {
    await fs.promises.unlink(SUMMARY_FILE);
  } catch (e) {
    // 文件不存在，忽略错误
  }
}

/**
 * 异步获取Token使用统计摘要
 */
export async function getTokenStatsSummaryFlatBufferAsync() {
  // 从摘要文件读取统计数据
  const summary = readSummary();
  // 从tokens.bin文件读取最近记录
  const recentRecords = await readRecentRecordsFromOffsetsAsync();
  
  // 转换摘要数据格式以匹配原有接口
  const apiTypeStats = {
    openai: {
      inputTokens: summary.byApiType.openai.inputTokens,
      outputTokens: summary.byApiType.openai.outputTokens,
      totalTokens: summary.byApiType.openai.tokens,
      count: summary.byApiType.openai.requests
    },
    anthropic: {
      inputTokens: summary.byApiType.anthropic.inputTokens,
      outputTokens: summary.byApiType.anthropic.outputTokens,
      totalTokens: summary.byApiType.anthropic.tokens,
      count: summary.byApiType.anthropic.requests
    }
  };
  
  const modelStats: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number; count: number }> = {};
  
  for (const [model, stats] of Object.entries(summary.byModel)) {
    modelStats[model] = {
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalTokens: stats.tokens,
      count: stats.requests
    };
  }
  
  return {
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    totalTokens: summary.totalTokens,
    totalRequests: summary.totalRequests,
    averageResponseTime: summary.totalRequests > 0 ? Math.round(summary.totalResponseTime / summary.totalRequests) : 0,
    apiTypeStats,
    modelStats,
    recentRequests: recentRecords
  };
}