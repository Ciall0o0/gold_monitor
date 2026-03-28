/**
 * AI分析模块
 * 调用OPENROUTER API进行黄金价格走势分析
 */

import type { Config } from '../utils/config';
import type { PriceData } from '../fetchers/price';
import type { TechnicalIndicators } from './technical';

export interface AIAnalysisResult {
  trend: 'up' | 'down' | 'neutral';
  confidence: number;
  reasoning: string;
  magnitude: 'small' | 'medium' | 'large';
  shouldAlert: boolean;
}

/**
 * 调用OPENROUTER API进行黄金走势分析
 */
export async function analyzeWithAI(
  config: Config,
  priceData: PriceData,
  indicators: TechnicalIndicators,
): Promise<AIAnalysisResult | null> {
  try {
    const prompt = buildAnalysisPrompt(priceData, indicators);

    const response = await fetch(config.OPENROUTERApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENROUTERApiKey}`
      },
      body: JSON.stringify({
        model: config.OPENROUTERModel,
        messages: [
          {
            role: 'system',
            content: `你是一位专业的黄金分析师，擅长技术分析和基本面分析。
请基于提供的价格数据、技术指标和市场新闻，分析黄金价格的短期走势（1-3天）。

判断"较大幅度涨跌"的标准：
- 大幅：单日波动 > 2% 或 技术形态出现突破/跌破关键位
- 中幅：单日波动 1-2%
- 小幅：单日波动 < 1%

请直接输出纯文本的 JSON 字符串，不要使用 Markdown 代码块标记（如 \`\`\`json），不要包含任何开场白或结束语，格式如下：
{
  "trend": "up" | "down" | "neutral",
  "confidence": 0-100,
  "reasoning": "简要分析理由（50字以内）",
  "magnitude": "small" | "medium" | "large"
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    const content = data.choices[0]?.message?.content;
    console.log('🔍 API 完整响应:', JSON.stringify(data, null, 2));
    if (!content) {
      console.warn('⚠️ API 返回内容为空，完整响应结构:', data);
      throw new Error('API返回内容为空');
    }

    return parseAIResponse(content, config.aiConfidenceThreshold);
  } catch (error) {
    console.error('AI分析失败:', error);
    return null;
  }
}

/**
 * 构建分析Prompt
 */
function buildAnalysisPrompt(
  priceData: PriceData,
  indicators: TechnicalIndicators,
): string {
  return `请分析黄金价格走势：

【价格数据】
- 当前价格: ${priceData.current.toFixed(2)}元/克
- 今日开盘: ${priceData.open.toFixed(2)}元/克
- 今日最高: ${priceData.high.toFixed(2)}元/克
- 今日最低: ${priceData.low.toFixed(2)}元/克
- 涨跌幅: ${priceData.change >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%

【技术指标】
- 5日均线: ${indicators.ma5.toFixed(2)}元 (偏离: ${(indicators.deviationFromMA5 * 100).toFixed(2)}%)
- 10日均线: ${indicators.ma10.toFixed(2)}元
- RSI(14): ${indicators.rsi14.toFixed(2)}
- 趋势判断: ${indicators.trend === 'up' ? '上涨' : indicators.trend === 'down' ? '下跌' : '横盘'}


请分析未来1-3天的价格走势，输出JSON格式结果。`;
}

/**
 * 解析AI返回的JSON结果
 */
function parseAIResponse(
  content: string,
  confidenceThreshold: number
): AIAnalysisResult | null {
  try {
    // 尝试提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从返回中提取JSON');
    }

    const result = JSON.parse(jsonMatch[0]) as {
      trend: string;
      confidence: number;
      reasoning: string;
      magnitude: string;
    };

    // 标准化字段
    const trend = ['up', 'down', 'neutral'].includes(result.trend)
      ? result.trend as 'up' | 'down' | 'neutral'
      : 'neutral';

    const magnitude = ['small', 'medium', 'large'].includes(result.magnitude)
      ? result.magnitude as 'small' | 'medium' | 'large'
      : 'small';

    // 判断是否应该预警
    // 条件1: 趋势明确（up或down）且置信度>=阈值
    // 条件2: 波动幅度为medium或large
    const shouldAlert =
      trend !== 'neutral' &&
      result.confidence >= confidenceThreshold &&
      (magnitude === 'medium' || magnitude === 'large');

    return {
      trend,
      confidence: result.confidence,
      reasoning: result.reasoning,
      magnitude,
      shouldAlert
    };
  } catch (error) {
    console.error('解析AI响应失败:', error);
    return null;
  }
}

/**
 * 格式化AI分析结果为文本
 */
export function formatAIResult(result: AIAnalysisResult): string {
  const trendText = {
    up: '📈 上涨',
    down: '📉 下跌',
    neutral: '➡️ 震荡'
  }[result.trend];

  const magnitudeText = {
    small: '小幅',
    medium: '中幅',
    large: '大幅'
  }[result.magnitude];

  return `
AI分析结果:
- 预测方向: ${trendText}
- 波动幅度: ${magnitudeText}
- 置信度: ${result.confidence}%
- 分析理由: ${result.reasoning}
`;
}
