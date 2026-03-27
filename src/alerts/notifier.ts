/**
 * 消息通知模块
 * 使用Server酱发送预警消息
 */

import type { Config } from '../utils/config';
import type { PriceData } from '../fetchers/price';
import type { TechnicalIndicators } from '../analysis/technical';
import type { AIAnalysisResult } from '../analysis/ai';

interface AlertContext {
  priceData: PriceData;
  indicators: TechnicalIndicators;
  aiResult?: AIAnalysisResult | null;
  triggerReason: 'price_deviation' | 'ai_prediction' | 'both';
}

/**
 * 发送预警通知
 */
export async function sendAlert(
  config: Config,
  context: AlertContext
): Promise<boolean> {
  try {
    const message = buildAlertMessage(context);
    const title = buildAlertTitle(context);

    const url = `https://sctapi.ftqq.com/${config.serverChanSendKey}.send`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        title: title,
        desp: message,
        channel: '9'  // 微信通道
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server酱发送失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { code: number; message: string };
    if (result.code !== 0) {
      throw new Error(`Server酱返回错误: ${result.message}`);
    }

    console.log('预警消息发送成功');
    return true;
  } catch (error) {
    console.error('发送预警通知失败:', error);
    return false;
  }
}


/**
 * 发送每日简报
 */
export async function sendDailySummary(
  config: Config,
  priceData: PriceData,
  indicators: TechnicalIndicators
): Promise<boolean> {
  try {
    const title = `⏰ 黄金日报 ${formatDate()} | 当前价格: ${priceData.current.toFixed(2)}`;

    const message = `
## 📊 今日行情

**当前价格**: ${priceData.current.toFixed(2)} 元/克
**今日涨跌**: ${priceData.change >= 0 ? '+' : ''}${priceData.change.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)
**今日最高**: ${priceData.high.toFixed(2)} 元/克
**今日最低**: ${priceData.low.toFixed(2)} 元/克

## 📈 技术指标

- 5日均线 (MA5): ${indicators.ma5.toFixed(2)} 元
- 10日均线 (MA10): ${indicators.ma10.toFixed(2)} 元
- RSI(14): ${indicators.rsi14.toFixed(2)}
- 趋势: ${indicators.trend === 'up' ? '上涨 📈' : indicators.trend === 'down' ? '下跌 📉' : '横盘 ➡️'}

## ⚠️ 偏离度

- 偏离MA5: ${(indicators.deviationFromMA5 * 100).toFixed(2)}%
- 偏离MA10: ${(indicators.deviationFromMA10 * 100).toFixed(2)}%

---
*发送时间: ${new Date(Date.now()).toLocaleString('zh',{timeZone: 'Asia/Shanghai', hour12:true})}*
`;

    const url = `https://sctapi.ftqq.com/${config.serverChanSendKey}.send`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        title: title,
        desp: message
      })
    });

    const result = await response.json() as { code: number };
    return result.code === 0;
  } catch (error) {
    console.error('发送日报失败:', error);
    return false;
  }
}

/**
 * 构建预警标题
 */
function buildAlertTitle(context: AlertContext): string {
  const { priceData, triggerReason } = context;
  const price = priceData.current.toFixed(2);
  const change = priceData.changePercent >= 0 ? '+' : '';

  let emoji = '🚨';
  let reason = '';

  if (triggerReason === 'price_deviation') {
    emoji = '📊';
    reason = '价格偏离预警';
  } else if (triggerReason === 'ai_prediction') {
    emoji = '🤖';
    reason = 'AI预测预警';
  } else if (triggerReason === 'both') {
    emoji = '🔥';
    reason = '双重信号预警';
  }

  return `${emoji} 黄金${reason} | ${price}元 ${change}${priceData.changePercent.toFixed(2)}%`;
}

/**
 * 构建预警消息内容
 */
function buildAlertMessage(context: AlertContext): string {
  const { priceData, indicators, aiResult, triggerReason } = context;

  let message = `
## 💰 价格信息

**当前价格**: ${priceData.current.toFixed(2)} 元/克
**今日涨跌**: ${priceData.change >= 0 ? '+' : ''}${priceData.change.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)
**今日最高**: ${priceData.high.toFixed(2)} 元/克
**今日最低**: ${priceData.low.toFixed(2)} 元/克

## 📊 技术指标

- 5日均线: ${indicators.ma5.toFixed(2)} 元
- 偏离MA5: ${(indicators.deviationFromMA5 * 100).toFixed(2)}%
- RSI(14): ${indicators.rsi14.toFixed(2)}
- 趋势: ${indicators.trend === 'up' ? '上涨' : indicators.trend === 'down' ? '下跌' : '横盘'}
`;

  // 添加触发原因
  message += `\n## ⚠️ 触发条件\n\n`;
  if (triggerReason === 'price_deviation' || triggerReason === 'both') {
    const direction = indicators.deviationFromMA5 > 0 ? '高于' : '低于';
    message += `✅ 价格${direction}5日均线超过5%\n`;
  }
  if (triggerReason === 'ai_prediction' || triggerReason === 'both') {
    message += `✅ AI预测有较大幅度${aiResult?.trend === 'up' ? '上涨' : '下跌'} (置信度${aiResult?.confidence}%)\n`;
  }

  // 添加AI分析详情
  if (aiResult) {
    const magnitudeText = {
      small: '小幅',
      medium: '中幅',
      large: '大幅'
    }[aiResult.magnitude];

    message += `\n## 🤖 AI分析\n\n- 预测方向: ${aiResult.trend === 'up' ? '📈 上涨' : aiResult.trend === 'down' ? '📉 下跌' : '➡️ 震荡'}
- 波动幅度: ${magnitudeText}
- 置信度: ${aiResult.confidence}%
- 分析理由: ${aiResult.reasoning}\n`;
  }

  message += `\n---\n*发送时间: ${new Date(Date.now()).toLocaleString('zh',{timeZone: 'Asia/Shanghai', hour12:true})}*\n*数据仅供参考，投资有风险*\n`;

  return message;
}

/**
 * 格式化日期
 */
function formatDate(): string {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}
