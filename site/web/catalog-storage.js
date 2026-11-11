'use strict';
// Lossless, versioned local storage. Old JSON remains readable; backups and
// owner edits remain complete even when the 91-scene catalog exceeds quota.
let aiddStorageDamaged=false;
let aiddStorageLastJSON='',aiddStorageLastEncoded='';
function aiddStorageEncode(value){
 if(aiddStorageDamaged)throw new Error('原存储未通过校验，已保留原数据。');
 const text=JSON.stringify(value);
 if(text===aiddStorageLastJSON)return aiddStorageLastEncoded;
 const encoded=text.length>100000&&typeof LZString!=='undefined'?'AIDD_LZ1:'+LZString.compressToUTF16(text):text;
 aiddStorageLastJSON=text;aiddStorageLastEncoded=encoded;return encoded;
}
function aiddStorageDecode(text){
 try{
 if(text?.startsWith('AIDD_LZ1:')){
  if(typeof LZString==='undefined')throw new Error('资产压缩格式暂不可读，原数据已保留。');
  const decoded=LZString.decompressFromUTF16(text.slice(9));if(!decoded)throw new Error('资产存储校验失败，原数据已保留。');return JSON.parse(decoded);
 }
 return JSON.parse(text||'null');
 }catch(error){aiddStorageDamaged=true;throw error;}
}
