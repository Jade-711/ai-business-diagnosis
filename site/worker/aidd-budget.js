// Conservative application-side allowance, not the provider account's invoice.
// Peak USD prices checked against DeepSeek's official pricing on 2026-11-02.
const PEAK_MICRO_USD_PER_TOKEN={
 'deepseek-flash':{input:0.3,output:1.2},
 'deepseek-v4-pro':{input:1.32,output:3.96}
};
export async function reserveAiddBudget(env,{model,instructions,input,maxOutputTokens},now=new Date()){
 const price=PEAK_MICRO_USD_PER_TOKEN[model];
 if(!price)throw new Error('AIDD 模型配置不受支持，请联系管理员。');
 const inputBytes=new TextEncoder().encode(instructions+'\n'+input).length;
 if(inputBytes>800000)throw new Error('本次生产资料过大，请缩小场景或资产范围。');
 // UTF-8 bytes bound text tokens; cover message overhead and reserve twice the
 // peak-price estimate. Do not refund timeouts: inference may have been billed.
 const reservation=Math.ceil(2*((inputBytes+2048)*price.input+maxOutputTokens*price.output));
 const dollars=Number(env.AIDD_MONTHLY_LIMIT_USD??5);
 if(!Number.isFinite(dollars)||dollars<0||dollars>5)throw new Error('AIDD 消费保护配置无效，已暂停模型调用。');
 const limit=Math.floor(dollars*1000000),month=now.toISOString().slice(0,7);
 if(!env.DB?.prepare)throw new Error('AIDD 消费保护暂不可用，已暂停模型调用。');
 let row;
 try{
  row=await env.DB.prepare(`INSERT INTO aidd_ai_budget (month,reserved_micro_usd,request_count,updated_at)
   SELECT ?,?,1,? WHERE ?<=?
   ON CONFLICT(month) DO UPDATE SET
    reserved_micro_usd=aidd_ai_budget.reserved_micro_usd+excluded.reserved_micro_usd,
    request_count=aidd_ai_budget.request_count+1,updated_at=excluded.updated_at
   WHERE aidd_ai_budget.reserved_micro_usd+excluded.reserved_micro_usd<=?
   RETURNING reserved_micro_usd,request_count`).bind(month,reservation,now.toISOString(),reservation,limit,limit).first();
 }catch{throw new Error('AIDD 消费保护暂不可用，已暂停模型调用。');}
 if(!row)throw new Error('本月 AIDD 生产已达到消费保护上限，请联系管理员。');
 return {month,limitUSD:dollars,reservedUSD:row.reserved_micro_usd/1000000,requestCount:row.request_count,accounting:'conservative_reservation'};
}
