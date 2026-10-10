import {validateEnvelope,validateSettings,DEFAULT_TIMES,LEGACY_TIMES} from './model.js';
const KEY='course-compass.v1';
export function emptyState(){return {version:1,courses:[],settings:validateSettings(),demo:false};}
export function loadState(){const data=localStorage.getItem(KEY);if(!data)return emptyState();try{return validateEnvelope(JSON.parse(data));}catch{throw Error('保存的课表无法读取。请先导出原始数据备份，再重置。');}}
export function saveState(state){const checked=validateEnvelope(state);try{localStorage.setItem(KEY,JSON.stringify(checked));}catch{throw Error('保存失败：浏览器存储空间不足或被禁用。请导出备份。');}return checked;}
export function rawBackup(){return localStorage.getItem(KEY)||'{}';}

// Migrate only the exact old preset. Never infer or overwrite a custom schedule.
export function migrateSchoolTimes(storage=localStorage){
 const text=storage.getItem(KEY);if(!text)return false;
 const raw=JSON.parse(text);validateEnvelope(raw);
 if(JSON.stringify(raw.settings?.times)!==JSON.stringify(LEGACY_TIMES))return false;
 const next={...raw,settings:{...raw.settings,times:[...DEFAULT_TIMES]}};
 validateEnvelope(next);storage.setItem(KEY,JSON.stringify(next));return true;
}
