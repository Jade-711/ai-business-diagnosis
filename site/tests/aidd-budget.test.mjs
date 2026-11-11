import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveAiddBudget} from '../worker/aidd-budget.js';
import {budgetDb} from './budget-db.mjs';
const request={model:'deepseek-flash',instructions:'仅使用提供资产',input:'演示资料',maxOutputTokens:4096};
test('并发预留使用数据库原子条件更新，保护限额不能被同时请求突破',async()=>{
 const DB=budgetDb();
 try{
  const env={DB,AIDD_MONTHLY_LIMIT_USD:'0.025'};
  const attempts=await Promise.allSettled(Array.from({length:20},()=>reserveAiddBudget(env,request,new Date('2026-11-02T00:00:00Z'))));
  const accepted=attempts.filter(r=>r.status==='fulfilled');assert.ok(accepted.length>0&&accepted.length<20);
  const row=DB.sqlite.prepare('SELECT * FROM aidd_ai_budget').get();
  assert.equal(row.request_count,accepted.length);assert.ok(row.reserved_micro_usd<=25000);
  assert.ok(attempts.filter(r=>r.status==='rejected').every(r=>/保护上限/.test(r.reason.message)));
 }finally{DB.sqlite.close();}
});
test('跨月自动使用新额度桶，服务端无数据库、未知模型、无效上限一律停止',async()=>{
 const DB=budgetDb();
 try{
  for(const month of ['2026-11','2026-12'])assert.equal((await reserveAiddBudget({DB},request,new Date(month+'-02T00:00:00Z'))).month,month);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM aidd_ai_budget').get().n,2);
  await assert.rejects(()=>reserveAiddBudget({},request),/保护暂不可用/);
  await assert.rejects(()=>reserveAiddBudget({DB,AIDD_MONTHLY_LIMIT_USD:'NaN'},request),/配置无效/);
  await assert.rejects(()=>reserveAiddBudget({DB,AIDD_MONTHLY_LIMIT_USD:'6'},request),/配置无效/);
  await assert.rejects(()=>reserveAiddBudget({DB,AIDD_MONTHLY_LIMIT_USD:'0'},request),/保护上限/);
  await assert.rejects(()=>reserveAiddBudget({DB},{...request,model:'unpriced-model'}),/不受支持/);
 }finally{DB.sqlite.close();}
});
