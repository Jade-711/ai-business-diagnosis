// Strategy definitions are independent of the period selected for execution.
export function sharedStrategy(strategy){
 const next={...strategy};delete next.period;
 if(next.protocol){next.protocol={...next.protocol};delete next.protocol.period;}
 return next;
}
export function shareCatalogStrategies(data){
 const copy=value=>JSON.parse(JSON.stringify(value));
 const clean=name=>String(name||'').replace(/（近7天）|（昨日）/g,'');
 const stable=value=>JSON.stringify(function order(v){return Array.isArray(v)?v.map(order):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;}(value));
 const ignored=new Set(['id','period','groupId','group','protocol','createdAt','updatedAt','version','history','mergedFromIds']);
 const signature=s=>stable(Object.fromEntries(Object.entries(s).filter(([key])=>!ignored.has(key))));
 const groupMap=new Map(),groupKeys=new Map(),groups=[];
 for(const original of data.groups||[]){
  const group={...copy(original),name:clean(original.name)};delete group.period;
  const key=stable(Object.fromEntries(Object.entries(group).filter(([key])=>!['id','createdAt','updatedAt','version'].includes(key))));
  let existing=groupKeys.get(key);
  if(!existing){group.id=group.id.replace(/^(research-group-\d+)-(?:week|day)$/,'$1');existing=group;groupKeys.set(key,existing);groups.push(existing);}
  groupMap.set(original.id,existing.id);
 }
 function merge(items){
  const keys=new Map(),ids=new Set(),result=[];
  for(const original of items){
   const item=sharedStrategy(copy(original));item.name=clean(item.name);item.groupId=groupMap.get(item.groupId)||item.groupId;
   item.group=groups.find(g=>g.id===item.groupId)?.name||clean(item.group);
   const key=signature(item);if(keys.has(key))continue;
   const base=item.id.replace(/^(research-strategy-\d+)-(?:week|day)-(\d+)$/,'$1-$2');let id=base,n=2;
   while(ids.has(id))id=base+'-variant-'+n++;
   item.id=id;
   if(result.some(s=>s.sceneId===item.sceneId&&s.groupId===item.groupId&&s.name===item.name))item.name+='（保留配置 '+(n-1)+'）';
   if(item.protocol){item.protocol.strategyCode=id;item.protocol.groupId=item.groupId;}
   ids.add(id);keys.set(key,item);result.push(item);
  }
  return result;
 }
 data.groups=groups;data.strategies=merge(data.strategies||[]);
 for(const published of Object.values(data.published||{})){
  const configs=published.periods?Object.values(published.periods):[published];
  const strategies=merge(configs.flatMap(c=>c.strategies||[]));
  for(const config of configs){config.strategies=copy(strategies);config.groups=copy(groups.filter(g=>g.sceneId===config.sceneId));}
 }
 if(data.catalog)data.catalog.strategyCount=data.strategies.length;
 data.strategyScopeVersion=1;return data;
}
