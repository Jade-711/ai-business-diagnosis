import {BUSINESS_SCENE_SPECS} from './scene-business-specs.js';
export const PROJECT_KNOWLEDGE_CARDS=Object.entries(BUSINESS_SCENE_SPECS).map(([name,spec])=>({name,decomposition:spec.decomposition,drilldown:spec.drilldown,boundary:spec.boundary,missing:spec.gaps,requiredEvidence:spec.requiredEvidence||[]}));
export function projectKnowledgeQuestion(question,cards=PROJECT_KNOWLEDGE_CARDS){
 const q=String(question||'');
 const direct=cards.filter(c=>q.includes(c.name)||q.includes(c.name.replaceAll('-',''))).sort((a,b)=>b.name.length-a.name.length);
 const selected=direct.length?direct.filter(c=>c.name.length===direct[0].name.length).slice(0,2):[];
 const definitions=[
  ['客单价|每单|成交金额|订单数','本产品客单价按成交金额÷去重成交人数解释；成交金额÷成交订单数称每单成交金额。订单数与人数不是同一个分母。比较须同商家、同统计周期、同成交及退款归因。'],
  ['率|比例|百分点','比例=同口径分子÷分母；分母为零或未提供时不计算。百分点是两期比例的差，百分比是相对变化。基期分子与两期分母为正时，令分子相对变化gN=新分子÷旧分子−1，分母相对变化gD=新分母÷旧分母−1；新比例÷旧比例=(1+gN)÷(1+gD)。gN>gD比例上升，gN<gD比例下降，二者相等则持平。增长记正、下降记负，不混用增幅与正数降幅。两者都增长时，分子增幅小于分母增幅会使比例下降；两者都下降时，分子降幅小于分母降幅会使比例上升。分母扩张而分子持平也能使比例下降，不能把“分子下降”说成比例下降的必要条件。只解释本题所需分支。'],
  ['动销','商品动销率按平台定义为同一统计时点和范围的动销商品数÷在架可售商品数。分子必须属于分母集合。分母扩张可使动销率下降，即使动销商品数不变；不能由集合数量推断原有同一批商品失去成交。'],
  ['退款','先区分金额退款率（退款金额÷对应成交金额）、订单退款率（退款订单数÷对应成交订单数）及支付日/结算日等归因。只在同归因批次及固定退款观察窗口下比较。分母下降得更快时，退款金额或订单数可减少而退款率升高；知识解释应给一个清楚标为假设的反例，不能冒充本店数据。'],
  ['曝光|点击|观看|PV|UV|人数|次数','PV是事件次数，UV是去重人数，两者的计数对象和去重口径不同，不能说它们本身只是分母不同。跨渠道UV需要去重。点击率的曝光和点击须属于同对象、同统计周期和同归因范围；次数点击率用次数，人数点击率用人数，不能互相替换。'],
  ['标题|封面|因果|根因','判断标题、封面或其他具体原因时，不能只写“需要对象级证据”。应列出本题需要取得的材料，例如标题原文或封面版本、对应场次/作品/商品ID、商品福利与实际兑现记录、同来源同周期的分子分母和可比对照；区分指标相关变化与因果证明。没有这些材料时只给待验证假设，不声称已查看素材。'],
  ['目标|预测|达标|达成','先明确目标适用周期、商家场域和成交口径，再用可比历史基线、季节/活动条件及可验证假设设定目标；结合预算、库存、人手等资源约束拆解流量、转化与每单金额，安排过程监测与复盘调整。不能把固定取几个历史周期或剔除大促规定为所有商家的必要条件。目标完成率=同周期实际值÷有效目标值×100%，差额=max(目标−实际,0)。刚好达成与超额不同。单期金额不能保证未来达标；目标缺失不编造完成率。']
 ].filter(([pattern])=>new RegExp(pattern,'i').test(q)).map(([,text])=>text);
 const reference={source:'本产品静态经营定义；不是本店事实或实时平台政策',definitions,scenes:selected,boundary:'指标定位数值变化环节；价格、库存、内容、服务等具体原因须对象级证据与对照验证。未提供平台规则时说明需查证。'};
 return q+'\n\n【本产品口径参考】\n'+JSON.stringify(reference)+'\n请直接回答原问题，覆盖核心解释、适用条件和必要限制；涉及比例方向时先将增减换成带正负号的相对变化，再按恒等式核对，反例明确标为假设。只写相关内容，不重复无关定义，不扩展未经核验的比例分支，不用“只有”等词把充分条件误写为必要条件。';
}
