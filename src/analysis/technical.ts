/**
 * 技术分析模块
 * 计算均线、偏离度等技术指标
 */

import type { PriceData } from '../fetchers/price';

export interface TechnicalIndicators {
  ma5: number;          // 5日均线
  ma10: number;         // 10日均线
  ma20: number;         // 20日均线
  deviationFromMA5: number;    // 偏离5日均线百分比
  deviationFromMA10: number;   // 偏离10日均线百分比
  rsi14: number;        // 14日RSI
  trend: 'up' | 'down' | 'sideways'; // 趋势判断
}

/**
 * 计算技术指标
 */
export function calculateIndicators(
  currentPrice: PriceData,
  priceHistory: PriceData[]
): TechnicalIndicators {
  // 提取收盘价列表（按时间排序）
  const prices = priceHistory.map(p => p.current);
  prices.push(currentPrice.current);

  // 计算均线
  const ma5 = calculateMA(prices, 5);
  const ma10 = calculateMA(prices, 10);
  const ma20 = calculateMA(prices, 20);

  // 计算偏离度
  const deviationFromMA5 = ma5 ? ((currentPrice.current - ma5) / ma5) : 0;
  const deviationFromMA10 = ma10 ? ((currentPrice.current - ma10) / ma10) : 0;

  // 计算RSI
  const rsi14 = calculateRSI(prices, 14);

  // 判断趋势
  const trend = determineTrend(prices, ma5, ma10);

  return {
    ma5: ma5 || currentPrice.current,
    ma10: ma10 || currentPrice.current,
    ma20: ma20 || currentPrice.current,
    deviationFromMA5,
    deviationFromMA10,
    rsi14,
    trend
  };
}

/**
 * 计算简单移动平均线 (SMA)
 */
function calculateMA(prices: number[], period: number): number | null {
  if (prices.length < period) {
    return null;
  }
  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 计算RSI (Relative Strength Index)
 */
function calculateRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) {
    return 50; // 数据不足时返回中性值
  }

  const recentPrices = prices.slice(-period - 1);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recentPrices.length; i++) {
    const change = recentPrices[i] - recentPrices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.min(100, Math.max(0, rsi));
}

/**
 * 判断趋势
 */
function determineTrend(
  prices: number[],
  ma5: number | null,
  ma10: number | null
): 'up' | 'down' | 'sideways' {
  if (!ma5 || !ma10 || prices.length < 10) {
    return 'sideways';
  }

  // 短期趋势判断
  const shortTermTrend = prices[prices.length - 1] > prices[prices.length - 5];
  const maTrend = ma5 > ma10;

  if (shortTermTrend && maTrend) {
    return 'up';
  } else if (!shortTermTrend && !maTrend) {
    return 'down';
  }

  return 'sideways';
}

/**
 * 检查是否触发价格偏离预警
 */
export function checkPriceDeviationAlert(
  indicators: TechnicalIndicators,
  threshold: number
): boolean {
  return Math.abs(indicators.deviationFromMA5) >= threshold;
}

/**
 * 格式化技术指标为文本
 */
export function formatIndicators(indicators: TechnicalIndicators): string {
  return `
技术指标分析:
- 5日均线 (MA5): ${indicators.ma5.toFixed(2)}
- 10日均线 (MA10): ${indicators.ma10.toFixed(2)}
- 20日均线 (MA20): ${indicators.ma20.toFixed(2)}
- 偏离MA5: ${(indicators.deviationFromMA5 * 100).toFixed(2)}%
- RSI(14): ${indicators.rsi14.toFixed(2)} (${getRSIDescription(indicators.rsi14)})
- 趋势: ${indicators.trend === 'up' ? '上涨' : indicators.trend === 'down' ? '下跌' : '横盘'}
`;
}

function getRSIDescription(rsi: number): string {
  if (rsi >= 70) return '超买';
  if (rsi >= 60) return '偏强';
  if (rsi >= 40) return '中性';
  if (rsi >= 30) return '偏弱';
  return '超卖';
}
