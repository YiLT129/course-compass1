import {validateEnvelope} from './model.js';

export const IMPORT_HISTORY_KEY='course-compass.import-history.v1';
export const IMPORT_JOURNAL='course-compass.import-journal.v1';
export const TIMETABLE_KEY='course-compass.v1';
export const IMPORTED_AT_KEY='course-compass.lastImport';
const KEYS=[TIMETABLE_KEY,IMPORTED_AT_KEY];
const empty=()=>({version:1,entries:[],undo:null});
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('导入记录时间无效');return value;}
function state(raw,canonical=true){
 if(!plain(raw))throw Error('导入恢复记录无效');
 const checked=raw.schedule===null?null:validateEnvelope(JSON.parse(raw.schedule)),schedule=checked===null?null:canonical?JSON.stringify(checked):raw.schedule;
 return {schedule,lastImport:raw.lastImport===null?null:timestamp(raw.lastImport)};
}
export function compareImports(old,next){
 const key=c=>JSON.stringify([c.name,c.day,c.start,c.end,c.weeks,c.location,c.teacher,c.note||'']),before=new Map();
 for(const c of old){const k=key(c);before.set(k,(before.get(k)||0)+1);}
 let same=0,added=0;for(const c of next){const k=key(c),count=before.get(k)||0;if(count){same++;before.set(k,count-1);}else added++;}
 return {same,added,removed:[...before.values()].reduce((a,b)=>a+b,0)};
}
export function validateImportHistory(raw){
 if(raw==null)return empty();
 if(!plain(raw)||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>5)throw Error('导入历史格式无效');
 const entries=raw.entries.map(x=>{
  if(!plain(x)||!plain(x.summary))throw Error('导入历史记录无效');
  const summary={};for(const k of ['same','added','removed']){const n=Number(x.summary[k]);if(!Number.isInteger(n)||n<0||n>1000)throw Error('导入历史数量无效');summary[k]=n;}
  return {id:String(x.id||'').slice(0,100),importedAt:timestamp(x.importedAt),label:String(x.label||'课表导入').slice(0,100),summary,undoneAt:x.undoneAt?timestamp(x.undoneAt):null};
 });
 let undo=null;if(raw.undo){
  const x=raw.undo;if(!plain(x)||!entries.some(e=>e.id===x.id&&!e.undoneAt))throw Error('导入撤回记录无效');
  if(x.school!==null&&(typeof x.school!=='string'||x.school.length>6000))throw Error('导入学校记录无效');
  undo={id:String(x.id),school:x.school,before:state(x.before),after:state(x.after)};
 }
 return {version:1,entries,undo};
}
export function currentImportState(storage){return {schedule:storage.getItem(TIMETABLE_KEY),lastImport:storage.getItem(IMPORTED_AT_KEY)};}
function courses(raw){return raw?validateEnvelope(JSON.parse(raw)).courses:[];}
export function createImportHistory(history,before,after,{label='课表导入',at=new Date().toISOString(),school=null,id=globalThis.crypto.randomUUID()}={}){
 history=validateImportHistory(history);before=state(before);after=state(after);
 const item={id,importedAt:timestamp(at),label:String(label).slice(0,100),summary:compareImports(courses(before.schedule),courses(after.schedule)),undoneAt:null};
 return validateImportHistory({version:1,entries:[item,...history.entries].slice(0,5),undo:{id,school,before,after}});
}
export function prepareUndo(history,current,school=null,at=new Date().toISOString()){
 history=validateImportHistory(history);const undo=history.undo;if(!undo)throw Error('没有可撤回的课表导入');
 current=state(current);if(school!==undo.school)throw Error('已切换学校，请切回导入时的学校再撤回');
 const present=current.schedule?validateEnvelope(JSON.parse(current.schedule)):null,after=undo.after.schedule?validateEnvelope(JSON.parse(undo.after.schedule)):null;
 if(JSON.stringify(present?.courses)!==JSON.stringify(after?.courses))throw Error('导入后课程已有其他修改，已保留当前课表，无法直接撤回');
 let schedule=undo.before.schedule;
 // Keep a manually edited calendar or bell schedule made after the import.
 if(schedule&&present&&JSON.stringify(present.settings)!==JSON.stringify(after?.settings)){const prior=validateEnvelope(JSON.parse(schedule));schedule=JSON.stringify({...prior,settings:present.settings});}
 if(!schedule&&present&&JSON.stringify(present.settings)!==JSON.stringify(after?.settings))schedule=JSON.stringify({...present,courses:[]});
 const next={schedule,lastImport:current.lastImport===undo.after.lastImport?undo.before.lastImport:current.lastImport};
 return {next,history:{...history,entries:history.entries.map(e=>e.id===undo.id?{...e,undoneAt:timestamp(at)}:e),undo:null}};
}
export function preflightImportStorage(storage,before,after){
 const size=s=>KEYS.reduce((n,k)=>n+(s[k===TIMETABLE_KEY?'schedule':'lastImport']?.length||0),0),growth=Math.max(0,size(after)-size(before))+256,key=IMPORT_JOURNAL+'.probe';
 try{storage.setItem(key,'x'.repeat(growth));}catch{throw Error('本机空间不足，未替换课表。请先导出备份或清理无用主题。');}finally{storage.removeItem(key);}
}
function writeState(storage,value){for(const key of KEYS)storage.removeItem(key);for(const [key,field]of [[TIMETABLE_KEY,'schedule'],[IMPORTED_AT_KEY,'lastImport']])if(value[field]!==null)storage.setItem(key,value[field]);}
export async function recoverImport(storage,persistence){
 const marker=storage.getItem(IMPORT_JOURNAL);if(!marker)return false;
 const pending=await persistence.pending();
 if(pending?.id===marker)writeState(storage,state(pending.before,false));
 storage.removeItem(IMPORT_JOURNAL);await persistence.clearPending();return true;
}
async function transactImport({storage,persistence,before,after,history,apply}){
 if(storage.getItem(IMPORT_JOURNAL)||storage.getItem('course-compass.restore-journal.v1'))throw Error('上次导入或恢复尚未完成，请重新打开课间后再试');
 preflightImportStorage(storage,before,after);const id=globalThis.crypto.randomUUID();let committed=false;
 await persistence.putPending({id,before});
 try{
  storage.setItem(IMPORT_JOURNAL,id);writeState(storage,after);
  if(apply&&apply()===false)throw Error('导入数据无法重新读取，已保留之前的课表');
  await persistence.finish(history);committed=true;storage.removeItem(IMPORT_JOURNAL);
 }catch(error){
  if(!committed){try{await recoverImport(storage,persistence);if(apply)apply();}catch{throw Error('课表恢复未完成，请重启课间；旧课表仍有恢复记录，不要清理应用数据。');}}
  throw error;
 }
 return history;
}
export async function commitTimetableImport({storage,persistence,value,apply,label='课表导入',at=new Date().toISOString(),school=null}){
 const before=currentImportState(storage),after={schedule:JSON.stringify(validateEnvelope(value)),lastImport:timestamp(at)},history=createImportHistory(await persistence.history(),before,after,{label,at,school});
 return transactImport({storage,persistence,before,after,history,apply});
}
export async function undoTimetableImport({storage,persistence,apply,school=null}){
 const before=currentImportState(storage),undo=prepareUndo(await persistence.history(),before,school);await transactImport({storage,persistence,before,after:undo.next,history:undo.history,apply});return undo.next;
}
