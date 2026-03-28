/**
 * 配置管理模块
 * 统一管理所有环境变量和配置项
 */

export interface Config {
  // OPENROUTER API
  OPENROUTERApiKey: string;
  OPENROUTERModel: string;
  OPENROUTERApiUrl: string;

  // Server酱
  serverChanSendKey: string;
  // Jina
  jinaApiKey: string;

  // Thresholds
  maWindow: number;
  priceDeviationThreshold: number;
  aiConfidenceThreshold: number;

}
import { Env } from "../index";
/**
 * 从环境变量加载配置
 */
export function loadConfig(env: Env): Config {
  return {
    // OPENROUTER
    OPENROUTERApiKey: env.OPENROUTER_API_KEY || '',
    OPENROUTERModel: env.OPENROUTER_MODEL || 'deepseek-ai/DeepSeek-V2.5',
    OPENROUTERApiUrl: env.OPENROUTER_API_URL || 'https://api.OPENROUTER.cn/v1/chat/completions',

    // Server酱
    serverChanSendKey: env.SERVERCHAN_SENDKEY || '',

    //Jina
    jinaApiKey: env.JINA_API_KEY || '',

    // Thresholds
    maWindow: parseInt(env.MA_WINDOW || '5', 10),
    priceDeviationThreshold: parseFloat(env.PRICE_DEVIATION_THRESHOLD || '0.05'),
    aiConfidenceThreshold: parseInt(env.AI_CONFIDENCE_THRESHOLD || '70', 10),

  };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.OPENROUTERApiKey) {
    errors.push('缺少 OPENROUTER_API_KEY');
  }

  if (!config.serverChanSendKey) {
    errors.push('缺少 SERVERCHAN_SENDKEY');
  }

  return errors;
}
