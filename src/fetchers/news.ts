/**
 * 黄金相关新闻获取模块
 * 从财联社等获取黄金相关新闻
 */
import type { Config } from '../utils/config';
export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  publishTime: string;
  source: string;
}

export interface NewsData {
  items: NewsItem[];
  timestamp: number;
}

/**
 * 获取黄金相关新闻
 */
export async function fetchGoldNews(config: Config): Promise<NewsData> {
  try {
    // 财联社黄金板块

    const response = await fetch(config.newsApiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      // 如果抓取失败，返回模拟数据
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('获取新闻失败:', error);
    return getMockNewsData();
  }
}

/**
 * 获取模拟新闻数据（用于测试）
 */
function getMockNewsData(): NewsData {
  return {
    items: [
      {
        title: '国际金价高位震荡',
        summary: '受美联储货币政策预期影响，国际金价维持高位震荡走势',
        url: '#',
        publishTime: new Date().toISOString(),
        source: '市场分析'
      },
      {
        title: '美元指数走弱支撑金价',
        summary: '美元指数持续走弱，为黄金价格提供支撑',
        url: '#',
        publishTime: new Date().toISOString(),
        source: '技术分析'
      }
    ],
    timestamp: Date.now()
  };
}

/**
 * 将新闻格式化为文本
 */
export function formatNewsForAI(newsData: NewsData): string {
  if (!newsData.items || newsData.items.length === 0) {
    return '暂无相关新闻';
  }

  return newsData.items
    .slice(0, 3) // 只取前3条
    .map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`)
    .join('\n');
}
