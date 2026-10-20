import {validateEnvelope,validateCourse} from './model.js';
import {validatePersonal} from './personalization.js';
import {validateAppearance,validateWidget,THEME_KEYS} from './appearance.js';
import {validateSchool} from './schools.js';
import {validateImportHistory,IMPORT_HISTORY_KEY} from './import-history.js';
import {validateOverrides} from './overrides.js';
export const MAX_PACKAGE=64*1024*1024;
export const STATE_KEYS=['course-compass.v1','course-compass.demo.prefs','course-compass.demo.personal','course-compass.personalization.v1','course-compass.school.v1','course-compass.lastImport','course-compass.widget-presets.v1','course-compass.overrides.v1',IMPORT_HISTORY_KEY];
export function allowedKey(k){return STATE_KEYS.includes(k)||/^course-compass\.(grades|user|profile)\.v1(?:\.[a-z0-9.-]+)?$/.test(k);}
function plain(v){return v&&typeof v==='object'&&!Array.isArray(v);}
export function validateResource(value){
 if(value==null)return null;
 if(!plain(value)||!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(value.type)||typeof value.data!=='string'||value.data.length>23*1024*1024||value.data.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(value.data)||!value.data.length)throw Error('备份图片无效或超过16MB');
 const prefixes={'image/png':'iVBORw0KGgo','image/jpeg':'/9j/','image/webp':'UklGR','image/gif':'R0lGOD'};
 if(prefixes[value.type]&&!value.data.startsWith(prefixes[value.type]))throw Error('图片内容与类型不一致');
 return {type:value.type,data:value.data};
}
export function validateTheme(raw){
 if(!plain(raw)||raw.format!=='course-compass.theme'||raw.version!==1)throw Error('不是支持的课间主题包');
 const appearance=validateAppearance(raw.appearance||{}),style={};for(const k of THEME_KEYS)style[k]=appearance[k];
 const custom=validatePersonal({items:raw.stickers||[]});if(custom.items.some(x=>x.type!=='sticker'))throw Error('主题仅能包含贴纸，不包含个人留言或链接');
 const wallpaper=validateResource(raw.wallpaper);if(style.wallpaper==='custom'&&!wallpaper)throw Error('主题缺少壁纸');
 return {format:raw.format,version:1,name:String(raw.name||'我的主题').trim().slice(0,40)||'我的主题',appearance:style,wallpaper,stickers:custom.items,widgetStyle:validateWidget(raw.widgetStyle||{})};
}
export function validateState(state){
 if(!plain(state)||Object.keys(state).length>180)throw Error('备份设置数量异常');
 const out={};for(const [key,raw] of Object.entries(state)){
  if(!allowedKey(key)||typeof raw!=='string'||raw.length>(key===IMPORT_HISTORY_KEY?6:2)*1024*1024)throw Error('备份包含不支持的数据项：'+key);
  if(key==='course-compass.lastImport'){if(Number.isNaN(Date.parse(raw)))throw Error('同步时间无效');out[key]=raw;continue;}
  let value;try{value=JSON.parse(raw);}catch{throw Error('备份数据损坏：'+key);}
  if(key==='course-compass.v1')value=validateEnvelope(value);
  else if(key==='course-compass.demo.prefs')value=validateAppearance(value);
  else if(key==='course-compass.demo.personal'){if(!Array.isArray(value)||value.length>1500)throw Error('个人安排无效');value=value.map((x,i)=>validateCourse(x,i));}
  else if(key==='course-compass.personalization.v1')value=validatePersonal(value);
  else if(key==='course-compass.school.v1')value=validateSchool(value);
  else if(key==='course-compass.overrides.v1')value=validateOverrides(value);
  else if(key===IMPORT_HISTORY_KEY)value=validateImportHistory(value);
  else if(key==='course-compass.widget-presets.v1'){if(!Array.isArray(value)||value.length>80)throw Error('组件设置无效');value=value.map(x=>({id:Math.max(0,Math.floor(Number(x.id)||0)),...validateWidget(x)}));}
  else if(!plain(value))throw Error('个人记录格式无效');
  out[key]=JSON.stringify(value);
 }
 return out;
}
export function validatePackage(raw){
 if(raw?.format==='course-compass.theme')return validateTheme(raw);
 if(!plain(raw)||raw.format!=='course-compass.backup'||raw.version!==1)throw Error('请选择课间完整备份或主题包；课表JSON请从「导入课表」导入');
 const state=validateState(raw.state),assets=raw.assets||{},themes=raw.themes||[];
 if(!Array.isArray(themes)||themes.length>8)throw Error('主题库最多8套');
 const value={format:raw.format,version:1,appVersion:String(raw.appVersion||'').slice(0,20),createdAt:String(raw.createdAt||''),state,assets:{wallpaper:validateResource(assets.wallpaper),original:validateResource(assets.original)},themes:themes.map(validateTheme)};
 const prefs=JSON.parse(state['course-compass.demo.prefs']||'{}');if(prefs.wallpaper==='custom'&&!value.assets.wallpaper)throw Error('备份缺少正在使用的壁纸');
 if(JSON.stringify(value).length>MAX_PACKAGE)throw Error('备份超过64MB，请减少主题库图片后重试');return value;
}
export function themeFromBackup(raw,name='我的主题'){
 const backup=validatePackage(raw);if(backup.format!=='course-compass.backup')throw Error('需要完整快照');
 const prefs=JSON.parse(backup.state['course-compass.demo.prefs']||'{}'),custom=validatePersonal(JSON.parse(backup.state['course-compass.personalization.v1']||'{}'));
 return validateTheme({format:'course-compass.theme',version:1,name,appearance:prefs,wallpaper:prefs.wallpaper==='custom'?backup.assets.wallpaper:null,stickers:custom.items.filter(x=>x.type==='sticker'),widgetStyle:{style:custom.widget.style,accent:custom.widget.accent,opacity:custom.widget.opacity}});
}
export function mergeTheme(backup,theme){
 backup=validatePackage(backup);theme=validateTheme(theme);const state={...backup.state};
 state['course-compass.demo.prefs']=JSON.stringify({...validateAppearance(JSON.parse(state['course-compass.demo.prefs']||'{}')),...theme.appearance});
 const personal=validatePersonal(JSON.parse(state['course-compass.personalization.v1']||'{}'));
 personal.items=[...personal.items.filter(x=>x.type!=='sticker'),...theme.stickers.map((x,i)=>({...x,id:'theme-'+i}))].slice(0,20);personal.visible=true;
 personal.widget={...personal.widget,style:theme.widgetStyle.style,accent:theme.widgetStyle.accent,opacity:theme.widgetStyle.opacity};state['course-compass.personalization.v1']=JSON.stringify(personal);
 return validatePackage({...backup,state,assets:theme.wallpaper?{wallpaper:theme.wallpaper,original:theme.wallpaper}:backup.assets});
}
