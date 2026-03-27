/**
 * 配置管理模块
 * 统一管理所有环境变量和配置项
 */

export interface Config {
  // SiliconFlow API
  siliconFlowApiKey: string;
  siliconFlowModel: string;
  siliconFlowApiUrl: string;

  // Server酱
  serverChanSendKey: string;
  // Jina
  jinaApiKey: string;

  // Thresholds
  maWindow: number;
  priceDeviationThreshold: number;
  aiConfidenceThreshold: number;

  // Data Sources
  priceApiUrl: string;
  newsApiUrl: string;
}
import { Env } from "../index";
/**
 * 从环境变量加载配置
 */
export function loadConfig(env: Env): Config {
  return {
    // SiliconFlow
    siliconFlowApiKey: env.SILICONFLOW_API_KEY || '',
    siliconFlowModel: env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V2.5',
    siliconFlowApiUrl: env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions',

    // Server酱
    serverChanSendKey: env.SERVERCHAN_SENDKEY || '',

    //Jina
    jinaApiKey: env.JINA_API_KEY || '',

    // Thresholds
    maWindow: parseInt(env.MA_WINDOW || '5', 10),
    priceDeviationThreshold: parseFloat(env.PRICE_DEVIATION_THRESHOLD || '0.05'),
    aiConfidenceThreshold: parseInt(env.AI_CONFIDENCE_THRESHOLD || '70', 10),

    // Data Sources
    priceApiUrl: env.PRICE_API_URL || 'https://hq.sinajs.cn/list=hf_AU0',
    newsApiUrl: env.NEWS_API_URL || "https://orz.ai/api/v1/dailynews/?platform=cls",
  };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.siliconFlowApiKey) {
    errors.push('缺少 SILICONFLOW_API_KEY');
  }

  if (!config.serverChanSendKey) {
    errors.push('缺少 SERVERCHAN_SENDKEY');
  }

  return errors;
}
