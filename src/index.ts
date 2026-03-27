/**
 * 黄金监测服务主入口
 * Cloudflare Workers Cron Trigger
 */

import { loadConfig, validateConfig } from './utils/config';
import { getPriceHistory, addPriceToHistory } from './utils/cache';
import { fetchGoldPrice } from './fetchers/price';
import { fetchGoldNews } from './fetchers/news';
import { calculateIndicators, checkPriceDeviationAlert } from './analysis/technical';
import { analyzeWithAI } from './analysis/ai';
import { sendAlert, sendDailySummary } from './alerts/notifier';

// Cloudflare Workers 环境变量类型定义
export interface Env {
  // Secrets
  SILICONFLOW_API_KEY: string;
  SERVERCHAN_SENDKEY: string;
  JINA_API_KEY: string;

  // Variables
  SILICONFLOW_MODEL?: string;
  SILICONFLOW_API_URL?: string;
  MA_WINDOW?: string;
  PRICE_DEVIATION_THRESHOLD?: string;
  AI_CONFIDENCE_THRESHOLD?: string;
  PRICE_API_URL?: string;
  NEWS_API_URL?: string;

  // KV Namespace
  PRICE_HISTORY: KVNamespace;
}

/**
 * 主处理函数
 */
export default {
  // Cron触发器处理
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron任务开始执行:', new Date().toISOString());

    try {
      await processGoldMonitoring(env);
    } catch (error) {
      console.error('Cron任务执行失败:', error);
    }

    console.log('Cron任务执行完成');
  },

  // HTTP请求处理（用于手动触发和测试）
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 健康检查
    if (path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 手动触发监测
    if (path === '/monitor' && request.method === 'POST') {
      try {
        await processGoldMonitoring(env);
        return new Response(JSON.stringify({
          success: true,
          message: '监测任务执行成功',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        return new Response(JSON.stringify({
          success: false,
          error: errorMessage
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 获取当前价格
    if (path === '/price') {
      const config = loadConfig(env);
      const errors = validateConfig(config);
      const priceData = await fetchGoldPrice(config);
      return new Response(JSON.stringify(priceData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取价格历史
    if (path === '/history') {
      const history = await getPriceHistory(env.PRICE_HISTORY);
      return new Response(JSON.stringify(history, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 发送测试消息
    if (path === '/test-alert' && request.method === 'POST') {
      const config = loadConfig(env);
      const errors = validateConfig(config);

      if (errors.length > 0) {
        return new Response(JSON.stringify({ errors }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const testPriceData = {
        current: 705.50,
        open: 702.00,
        high: 708.00,
        low: 700.00,
        previousClose: 700.00,
        timestamp: Date.now(),
        change: 5.50,
        changePercent: 0.79
      };

      const testIndicators = {
        ma5: 672.00,
        ma10: 668.00,
        ma20: 660.00,
        deviationFromMA5: 0.05,  // 5%偏离
        deviationFromMA10: 0.056,
        rsi14: 65,
        trend: 'up' as const
      };

      const success = await sendAlert(config, {
        priceData: testPriceData,
        indicators: testIndicators,
        triggerReason: 'price_deviation'
      });

      return new Response(JSON.stringify({
        success,
        message: success ? '测试消息已发送' : '发送失败'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 默认返回API文档
    return new Response(getApiDocs(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};

/**
 * 核心监测处理逻辑
 */
async function processGoldMonitoring(env: Env): Promise<void> {
  // 1. 加载配置
  const config = loadConfig(env);
  const errors = validateConfig(config);

  if (errors.length > 0) {
    console.error('配置验证失败:', errors);
    throw new Error(`配置错误: ${errors.join(', ')}`);
  }

  console.log('配置加载成功');

  // 2. 获取当前价格
  console.log('获取黄金价格...');
  const priceData = await fetchGoldPrice(config);

  if (!priceData) {
    throw new Error('获取价格数据失败');
  }

  console.log(`当前价格: ${priceData.current.toFixed(2)}`);

  // 3. 获取历史价格数据
  console.log('获取历史价格...');
  const priceHistory = await getPriceHistory(env.PRICE_HISTORY);

  // 4. 保存当前价格到历史
  await addPriceToHistory(env.PRICE_HISTORY, priceData);

  // 5. 计算技术指标
  console.log('计算技术指标...');
  const indicators = calculateIndicators(priceData, priceHistory);

  console.log(`MA5: ${indicators.ma5.toFixed(2)}, 偏离度: ${(indicators.deviationFromMA5 * 100).toFixed(2)}%`);

  // 6. 获取新闻数据
  console.log('获取市场新闻...');
  const newsData = await fetchGoldNews();

  // 7. AI分析
  console.log('进行AI分析...');
  const aiResult = await analyzeWithAI(config, priceData, indicators, newsData);

  if (aiResult) {
    console.log(`AI分析结果: ${aiResult.trend}, 置信度: ${aiResult.confidence}%, 应预警: ${aiResult.shouldAlert}`);
  }

  // 8. 判断是否触发预警
  const priceDeviationAlert = checkPriceDeviationAlert(
    indicators,
    config.priceDeviationThreshold
  );

  const aiPredictionAlert = aiResult?.shouldAlert ?? false;

  console.log(`价格偏离预警: ${priceDeviationAlert}, AI预测预警: ${aiPredictionAlert}`);

  // 9. 发送预警（如果需要）
  if (priceDeviationAlert || aiPredictionAlert) {
    let triggerReason: 'price_deviation' | 'ai_prediction' | 'both';

    if (priceDeviationAlert && aiPredictionAlert) {
      triggerReason = 'both';
    } else if (priceDeviationAlert) {
      triggerReason = 'price_deviation';
    } else {
      triggerReason = 'ai_prediction';
    }

    console.log('发送预警通知...');
    await sendAlert(config, {
      priceData,
      indicators,
      aiResult,
      triggerReason
    });
  } else {
    console.log('未达到预警条件，跳过发送');
  }

  // 10. 在特定时间发送日报（每天9:30开盘时）
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours === 9 && minutes >= 30 && minutes < 45) {
    console.log('发送开盘日报...');
    await sendDailySummary(config, priceData, indicators);
  }

  console.log('监测任务完成');
}

/**
 * API文档
 */
function getApiDocs(): string {
  return `
黄金监测服务 API
================

定时任务: 每15分钟自动执行一次监测

手动接口:
---------

GET /health
  健康检查

GET /price
  获取当前黄金价格

GET /history
  获取价格历史数据

POST /monitor
  手动触发监测任务

POST /test-alert
  发送测试预警消息（验证Server酱配置）

触发条件:
---------
1. 价格偏离5日均线超过5%
2. AI预测有较大涨跌可能（置信度>70%）

数据流:
-------
新浪财经API → 技术指标计算 → AI分析 → Server酱推送
`;
}
