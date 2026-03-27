/**
 * 黄金价格数据获取模块
 * 多源获取确保可靠性
 */

export interface PriceData {
  current: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: number;
  change: number;
  changePercent: number;
  source?: string;
  name?: string;
}

// 数据源列表
const PRICE_SOURCES = [
  { name: '浙商银行积存金 (Jina)', url: 'https://r.jina.ai/https://jdjr.jd.com/?oldVersion=true', type: 'jd_jina', code: 'ZSBANK' },
];

// Jina API Key
const JINA_API_KEY = 'jina_3b33c4f8b02c4397b0594f817118ac03MbNwjVCp8h8ZVoQb6dHo2ZENPi3f';

export async function fetchGoldPrice(): Promise<PriceData | null> {
  for (const source of PRICE_SOURCES) {
    try {
      console.log(`[Price] Trying ${source.name}...`);

      const response = await fetch(source.url, {
        headers: {
          'Referer': 'jd_jina',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': source.type === 'jd_jina' ? 'text/plain' : '*/*',
          'Authorization': `Bearer ${JINA_API_KEY}`,
          'X-Return-Format': 'text',
        },
        cf: { cacheTtl: 0 },
      });

      if (!response.ok) {
        console.log(`[Price] ${source.name} HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      console.log(`[Price] ${source.name} raw: ${text.substring(0, 200)}`);

      let result: PriceData | null = null;

      if (source.type === 'jd_jina') {
        result = parseJinaResponse(text, source);
      }

      if (result) {
        console.log(`[Price] ${source.name} OK: ${result.current} (${result.name})`);
        return result;
      }
    } catch (error) {
      console.error(`[Price] ${source.name} error:`, error);
    }
  }

  return null;
}

// 解析 Jina Reader API 返回的文本内容
function parseJinaResponse(responseText: string, source: typeof PRICE_SOURCES[0]): PriceData | null {
  try {
    // Jina 返回纯文本，格式示例:
    // 黄金 9999
    // 987.60
    // -3.76-0.37%

    // 尝试匹配各种价格格式
    const pricePatterns = [
      // 格式：买入:XXX.XX 卖出:XXX.XX
      /买入 [：:]\s*(\d+\.?\d*)[\s\S]*?卖出 [：:]\s*(\d+\.?\d*)/i,
      // 格式：买价:XXX.XX 卖价:XXX.XX
      /买 [价金] [：:]\s*(\d+\.?\d*)[\s\S]*?卖 [价金] [：:]\s*(\d+\.?\d*)/i,
      // 格式：黄金 9999 后跟价格
      /黄金\s*9999\s*\n\s*(\d+\.?\d*)/i,
      // 格式：黄金 T+D 后跟价格
      /黄金\s*T\+D\s*\n\s*(\d+\.?\d*)/i,
      // 格式：当前价:XXX.XX
      /(?:当前 [价金]|最新 [价金])[：:]\s*(\d+\.?\d*)/i,
      // 格式：XXX.XX 元
      /(\d+\.?\d+)\s*元/i,
    ];

    let buyPrice: number | null = null;
    let sellPrice: number | null = null;
    let currentPrice: number | null = null;
    let changePercent: number | null = null;

    // 尝试第一个模式（买入/卖出）
    let match = responseText.match(pricePatterns[0]);
    if (match) {
      buyPrice = parseFloat(match[1]);
      sellPrice = parseFloat(match[2]);
      currentPrice = (buyPrice + sellPrice) / 2;
      console.log(`[Price] Jina matched buy/sell: ${buyPrice}/${sellPrice}`);
    } else {
      // 尝试第二个模式（买价/卖价）
      match = responseText.match(pricePatterns[1]);
      if (match) {
        buyPrice = parseFloat(match[1]);
        sellPrice = parseFloat(match[2]);
        currentPrice = (buyPrice + sellPrice) / 2;
        console.log(`[Price] Jina matched buy/sell price: ${buyPrice}/${sellPrice}`);
      }
    }

    // 尝试黄金 9999 格式
    if (!currentPrice) {
      match = responseText.match(pricePatterns[2]);
      if (match) {
        currentPrice = parseFloat(match[1]);
        console.log(`[Price] Jina matched gold 9999 price: ${currentPrice}`);

        // 尝试提取涨跌幅
        const pctMatch = responseText.match(/黄金\s*9999\s*\n\s*\d+\.?\d*\s*\n\s*-?\d+\.?\d*([-+]\d+\.?\d*)%/);
        if (pctMatch) {
          changePercent = parseFloat(pctMatch[1]);
          console.log(`[Price] Jina matched changePercent: ${changePercent}`);
        }
      }
    }

    // 尝试黄金 T+D 格式
    if (!currentPrice) {
      match = responseText.match(pricePatterns[3]);
      if (match) {
        currentPrice = parseFloat(match[1]);
        console.log(`[Price] Jina matched gold TD price: ${currentPrice}`);
      }
    }

    // 尝试当前价
    if (!currentPrice) {
      match = responseText.match(pricePatterns[4]);
      if (match) {
        currentPrice = parseFloat(match[1]);
        console.log(`[Price] Jina matched current price: ${currentPrice}`);
      }
    }

    // 最后尝试元/克格式
    if (!currentPrice) {
      match = responseText.match(pricePatterns[5]);
      if (match) {
        currentPrice = parseFloat(match[1]);
        console.log(`[Price] Jina matched yuan/g price: ${currentPrice}`);
      }
    }

    if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
      console.log(`[Price] Jina: No valid price found`);
      return null;
    }

    // 如果没有买卖价，使用当前价估算
    if (!buyPrice || !sellPrice) {
      buyPrice = currentPrice - 1;
      sellPrice = currentPrice + 1;
    }

    const previousClose = currentPrice;
    const change = changePercent && changePercent !== 0
      ? (currentPrice * changePercent / 100)
      : 0;

    return {
      current: currentPrice,
      open: currentPrice,
      high: Math.max(currentPrice, sellPrice),
      low: Math.min(currentPrice, buyPrice),
      previousClose,
      timestamp: Date.now(),
      change,
      changePercent: changePercent || 0,
      source: 'jd_jina',
      name: '京东金融 - 黄金 9999',
    };
  } catch (error) {
    console.error(`[Price] Jina parse error:`, error);
    return null;
  }
}


// 黄金期货/延期格式：最新，今开，最高，最低，昨结,...
function parseGold(fields: string[], sourceName: string): PriceData | null {
  if (fields.length < 5) {
    console.log(`[Price] Gold fields too short: ${fields.length}`);
    return null;
  }

  const current = parseFloat(fields[0]);
  const open = parseFloat(fields[1]);
  const high = parseFloat(fields[2]);
  const low = parseFloat(fields[3]);
  const previousClose = parseFloat(fields[4]);

  if (isNaN(current) || current <= 0) {
    console.log(`[Price] Gold invalid price: ${current}`);
    return null;
  }

  const change = current - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    current,
    open,
    high,
    low,
    previousClose,
    timestamp: Date.now(),
    change,
    changePercent,
    source: 'gold',
    name: sourceName
  };
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatChangePercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
