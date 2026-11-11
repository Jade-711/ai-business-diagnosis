export function parseModelUsageRecords(value) {
 if (value == null || value === '') return [];
 if (typeof value === 'string') return parseModelUsageRecords(JSON.parse(value));
 if (Array.isArray(value)) return value.flatMap(parseModelUsageRecords);
 if (!value || typeof value !== 'object') throw new Error('模型用量格式无效');
 const stages = ['understanding', 'explanation', 'repair', 'knowledge'];
 if (!stages.includes(value.stage)) throw new Error('模型用量缺少调用阶段');
 const fields = ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens', 'reasoningTokens'];
 const available = fields.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
  && value.inputTokens + value.outputTokens === value.totalTokens
  && value.cachedInputTokens <= value.inputTokens
  && value.reasoningTokens <= value.outputTokens;
 return [{stage: value.stage, available,
  ...(typeof value.responseId === 'string' ? {responseId: value.responseId} : {}),
  ...(typeof value.model === 'string' ? {model: value.model} : {}),
  ...(['none', 'low', 'high'].includes(value.reasoningEffort) ? {reasoningEffort: value.reasoningEffort} : {}),
  ...(available ? Object.fromEntries(fields.map(key => [key, value[key]])) : {})}];
}

export function summarizeModelUsage(value) {
 const nodes = {
  understanding: ['110004', '理解复杂问法'],
  explanation: ['310002', '生成原因判断与行动建议'],
  repair: ['410021', '补全未通过核查的回答'],
  knowledge: ['110009', '回答经营知识问题']
 };
 const seen = new Set(), counts = {};
 const calls = parseModelUsageRecords(value).filter(call => {
  if (!call.responseId) return true;
  if (seen.has(call.responseId)) return false;
  seen.add(call.responseId);
  return true;
 }).map(call => ({...call, nodeId: nodes[call.stage][0], nodeName: nodes[call.stage][1],
  callIndex: counts[call.stage] = (counts[call.stage] || 0) + 1}));
 const complete = calls.every(call => call.available);
 const fields = ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens', 'reasoningTokens'];
 return {provider: 'DeepSeek', accounting: 'provider_usage',
  model: [...new Set(calls.map(call => call.model).filter(Boolean))].join('、'),
  complete, callCount: calls.length, calls,
  ...(complete ? Object.fromEntries(fields.map(key => [key, calls.reduce((sum, call) => sum + call[key], 0)])) : {})};
}
