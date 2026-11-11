import {readFile,writeFile} from 'node:fs/promises';
import {repairPublishedActionMappings} from '../shared/published-actions.js';
const path=new URL('../web/curated-catalog.js',import.meta.url),source=await readFile(path,'utf8'),prefix='const AIDD_CURATED_CATALOG = ';
const catalog=JSON.parse(source.split(prefix)[1].trim().replace(/;$/,''));
if(catalog.dashboardActionMappingVersion!==1){await writeFile(path,source.slice(0,source.indexOf(prefix))+prefix+JSON.stringify(repairPublishedActionMappings(catalog))+';\n');console.log('Updated reviewed published action mappings');}
