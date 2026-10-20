export const JOURNAL='course-compass.restore-journal.v1';
export function openAssets(){return new Promise((resolve,reject)=>{const r=indexedDB.open('course-compass-demo-assets',3);r.onupgradeneeded=()=>{for(const n of ['images','themes','recovery'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('请关闭其他课间窗口后再试'));});}
async function transact(names,mode,action){const db=await openAssets();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let result;try{action(tx,v=>result=v);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('图片保存失败'));tx.onabort=()=>reject(tx.error||Error('图片操作已取消'));});}finally{db.close();}}
// ArrayBuffer records also work on WebKit builds that cannot persist Blob values.
async function storedImage(value){return value instanceof Blob?{imageRecord:1,type:value.type,bytes:await value.arrayBuffer()}:value;}
function loadedImage(value){return value?.imageRecord===1?new Blob([value.bytes],{type:value.type}):value;}
async function storedImages(images){return Object.fromEntries(await Promise.all(Object.entries(images).map(async([k,v])=>[k,await storedImage(v)])));}
export async function imageStore(action,blob,key='wallpaper'){const value=action==='put'?await storedImage(blob):blob;return transact(['images'],action==='get'?'readonly':'readwrite',(tx,done)=>{const s=tx.objectStore('images'),r=action==='get'?s.get(key):action==='delete'?s.delete(key):s.put(value,key);r.onsuccess=()=>done(action==='get'?loadedImage(r.result):r.result);});}
export async function readAssets(){return transact(['images','themes','recovery'],'readonly',(tx,done)=>{const images={},themes=[];let history=null,pending=4;const finish=()=>{if(--pending===0)done({images,themes,history});};for(const k of ['wallpaper','original']){const r=tx.objectStore('images').get(k);r.onsuccess=()=>{images[k]=loadedImage(r.result)||null;finish();};}const r=tx.objectStore('themes').getAll();r.onsuccess=()=>{themes.push(...r.result);finish();};const h=tx.objectStore('recovery').get('import-history');h.onsuccess=()=>{history=h.result||null;finish();};});}
export async function saveTheme(theme){const current=await readAssets();if(current.themes.length>=8&&!current.themes.some(t=>t.name===theme.name))throw Error('主题库最多8套，请先删除一套');await transact(['themes'],'readwrite',(tx)=>{tx.objectStore('themes').put(theme,theme.name);});}
export async function deleteTheme(name){await transact(['themes'],'readwrite',tx=>tx.objectStore('themes').delete(name));}
async function writeAssets(next,previous,id,state){const images=await storedImages(next.images),journal=previous?{id,...previous,images:await storedImages(previous.images),state}:null;await transact(['images','themes','recovery'],'readwrite',tx=>{const s=tx.objectStore('images');if(journal)s.put(journal,'__restore');for(const k of ['wallpaper','original']){if(images[k])s.put(images[k],k);else s.delete(k);}const t=tx.objectStore('themes');t.clear();for(const theme of next.themes)t.put(theme,theme.name);const recovery=tx.objectStore('recovery');if(next.history)recovery.put(next.history,'import-history');else recovery.delete('import-history');});}
export async function recoverRestore(){
 const raw=localStorage.getItem(JOURNAL);if(!raw)return false;const journal=JSON.parse(raw),previous=await imageStore('get',null,'__restore');
 if(previous?.id===journal.id)await writeAssets(previous,null,null);
 const before=previous?.id===journal.id?previous.state:journal.before;if(before){for(const k of Object.keys(before))localStorage.removeItem(k);for(const [k,v]of Object.entries(before))if(v!==null)localStorage.setItem(k,v);}localStorage.removeItem(JOURNAL);await imageStore('delete',null,'__restore');return true;
}

export async function recoveryRecord(key){return transact(['recovery'],'readonly',(tx,done)=>{const r=tx.objectStore('recovery').get(key);r.onsuccess=()=>done(r.result||null);});}
export async function writeRecoveryRecord(key,value){return transact(['recovery'],'readwrite',tx=>{const store=tx.objectStore('recovery');if(value===null)store.delete(key);else store.put(value,key);});}
export const importPersistence={
 history:()=>recoveryRecord('import-history'),pending:()=>recoveryRecord('import-pending'),putPending:value=>writeRecoveryRecord('import-pending',value),clearPending:()=>writeRecoveryRecord('import-pending',null),
 finish:history=>transact(['recovery'],'readwrite',tx=>{const store=tx.objectStore('recovery');store.put(history,'import-history');store.delete('import-pending');})
};
export async function commitUpgradeSnapshot(version,snapshot){return transact(['recovery'],'readwrite',tx=>{const store=tx.objectStore('recovery');if(snapshot)store.put(snapshot,'upgrade-backup');store.put(version,'app-version');});}
export async function commitRestore(state,assets,keys){
 const previous=await readAssets(),before=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),id=crypto.randomUUID();
 if(localStorage.getItem(JOURNAL)||localStorage.getItem('course-compass.import-journal.v1'))throw Error('已有恢复或导入任务未完成，请重新打开课间后再试');
 localStorage.setItem(JOURNAL,JSON.stringify({id}));
 try{await writeAssets(assets,previous,id,before);for(const k of keys)localStorage.removeItem(k);for(const k of keys)if(k!=='course-compass.import-history.v1'&&Object.hasOwn(state,k))localStorage.setItem(k,state[k]);localStorage.removeItem(JOURNAL);}
 catch(error){try{await recoverRestore();}catch{throw Error('恢复未完成，旧数据仍有恢复记录。请重启课间，不要清理应用数据。');}throw error;}
 try{await imageStore('delete',null,'__restore');}catch{} // The new state is already committed; stale staging is harmless.
}
