import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../web/curated-catalog.js',import.meta.url),source=await readFile(file,'utf8');
const catalog=JSON.parse(source.split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
if(catalog.demoData.videoExposureFixtureVersion===1){console.log('Reviewed short-video exposure fixtures already installed');process.exit(0);}
// Independent, declared synthetic cases, with PV >= UV and paid UV <= total UV
// for both periods and every daily point. Daily UV is never summed as weekly UV.
const fixtures={
 'research-metric-video-06':{value:300000,previousValue:420000,current:[48000,46000,44000,43000,42000,40000,37000],previous:[54000,56000,58000,60000,62000,64000,66000]},
 'research-metric-video-07':{value:150000,previousValue:210000,current:[26000,25000,24000,23000,22000,21000,20000],previous:[28000,30000,32000,34000,36000,38000,40000]},
 'research-metric-video-21':{value:30000,previousValue:60000,current:[5000,4800,4500,4200,4000,3800,3700],previous:[7000,7500,8000,8500,9000,9500,10500]}
};
const buckets=value=>{const weights=[8,11,14,16,17,17,17],out=weights.map(w=>Math.floor(value*w/100));out[6]+=value-out.reduce((a,b)=>a+b,0);return out;};
for(const [id,week] of Object.entries(fixtures))catalog.demoData.metrics[id]={week,day:{value:week.current[6],previousValue:week.current[5],current:buckets(week.current[6]),previous:buckets(week.current[5])}};
catalog.demoData.videoExposureFixtureVersion=1;
await writeFile(file,source.slice(0,source.indexOf('const AIDD_CURATED_CATALOG = '))+`const AIDD_CURATED_CATALOG = ${JSON.stringify(catalog)};\n`);
console.log('Repaired the explicitly synthetic short-video exposure fixtures');
