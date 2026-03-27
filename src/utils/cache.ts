/**
 * Cloudflare KV 缓存工具
 * 用于存储价格历史数据
 */

import type { PriceData } from '../fetchers/price';

const PRICE_HISTORY_KEY = 'price_history';
const MAX_HISTORY_DAYS = 30; // 保留30天数据

/**
 * 获取价格历史
 */
export async function getPriceHistory(kv: KVNamespace): Promise<PriceData[]> {
  try {
    const data = await kv.get(PRICE_HISTORY_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as PriceData[];
  } catch (error) {
    console.error('获取价格历史失败:', error);
    return [];
  }
}

/**
 * 添加新的价格数据到历史
 */
export async function addPriceToHistory(
  kv: KVNamespace,
  priceData: PriceData
): Promise<void> {
  try {
    const history = await getPriceHistory(kv);

    // 添加新数据
    history.push(priceData);

    // 清理过期数据（保留最近30天）
    const cutoffTime = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const filteredHistory = history.filter(
      (item) => item.timestamp > cutoffTime
    );

    // 按时间排序
    filteredHistory.sort((a, b) => a.timestamp - b.timestamp);

    // 保存
    await kv.put(PRICE_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch (error) {
    console.error('保存价格历史失败:', error);
  }
}

/**
 * 清除价格历史
 */
export async function clearPriceHistory(kv: KVNamespace): Promise<void> {
  try {
    await kv.delete(PRICE_HISTORY_KEY);
  } catch (error) {
    console.error('清除价格历史失败:', error);
  }
}
