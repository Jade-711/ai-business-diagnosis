// A follow-up inherits the last explicit business task; an explicit new task wins.
// The model still resolves ambiguous wording and scope in the existing nodes.
export function assistantConfirmedRequest(params){
 const classify=text=>{
  const q=String(text||'');
  if(/^(?:请|帮我|请你|麻烦|麻烦你|能否|可以|先|继续|接着|我想)*(?:分析|诊断)(?!是什么|是什么意思|的定义)/.test(q))return 'diagnosis';
  if(/(?:只要|只给|只查|只返回).{0,12}(?:数字|数值|金额)|不用分析|先不分析/.test(q))return 'data';
  if(/什么是|是什么|是什么意思|定义|统计口径|指标口径|怎么理解|如何制定|怎么制定|通用方法/.test(q))return 'knowledge';
  // A generic why-question can be knowledge; do not override model intent
  // merely because the wording asks why or mentions a cause.
  if(/分析|诊断|异常|改善|建议|经营情况|整体经营|经营表现|目标差距/.test(q))return 'diagnosis';
  if(/解释.{0,12}(?:比率|比例|口径|公式)/.test(q))return 'knowledge';
  if(/查询|查数|取数|列出.{0,8}(数值|数据)|只看.{0,8}(数值|数据)/.test(q)||/多少/.test(q)&&!/如何计算|怎么计算|如何理解|怎么理解|解释|口径|公式|为什么|为啥|举例/.test(q))return 'data';
  return '';
 };
 const q=String(params.question||''),explicit=classify(q);
 if(explicit)return {...params,intent:explicit};
 if(!/那|这|继续|接着|还有|另一|下一个/.test(q)||q.length>80)return params;
 const history=Array.isArray(params.history)?params.history:[];
 for(const role of ['user','assistant'])for(let i=history.length-1;i>=0;i--){
  const h=history[i];if(!h||h.role!==role)continue;
  const intent=classify(h.content);
  if(intent)return {...params,intent,reason:'本轮未明确切换任务，承接最近有效会话中的'+intent+'任务；范围仍按本轮提问、指代和已确认上下文逐字段核对。'};
 }
 return params;
}
