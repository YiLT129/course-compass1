import {validateEnvelope,validateSettings,parseDate,dateKey,addDays,weekAt} from './model.js';
import {blocksFor} from './sessions.js';

export const PEER_KEY='course-compass.peer-timetable.v1';
export const DRAW_KEY='course-compass.draw-boxes.v1';
const text=(value,max)=>String(value??'').trim().slice(0,max);
export function parsePeer(raw,name='朋友'){
 const envelope=validateEnvelope(raw);if(envelope.demo)throw Error('这是一份演示课表，请让朋友导出自己的课表备份');
 return {version:1,name:text(name,30)||'朋友',importedAt:new Date().toISOString(),envelope};
}
export function validatePeer(raw){
 if(!raw||raw.version!==1||typeof raw.importedAt!=='string'||!Number.isFinite(Date.parse(raw.importedAt)))throw Error('朋友课表记录无效');
 const peer=parsePeer(raw.envelope,raw.name);peer.importedAt=raw.importedAt;return peer;
}
export function timeMinutes(value){const m=String(value??'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);if(!m)throw Error('请输入有效的时分');return +m[1]*60+(+m[2]);}
export function formatMinutes(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function mergeIntervals(ranges){const out=[];for(const range of ranges.sort((a,b)=>a.start-b.start||a.end-b.end)){const last=out.at(-1);if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end);else out.push({...range});}return out;}
export function coursesOnDate(envelope,date){
 const settings=validateSettings(envelope.settings),d=typeof date==='string'?parseDate(date):date,week=weekAt(settings.startDate,d),day=(d.getDay()+6)%7+1;
 if(week<1||week>settings.totalWeeks)return {withinTerm:false,week,courses:[],occupied:[]};
 const courses=envelope.courses.filter(c=>c.day===day&&c.weeks.includes(week));
 const occupied=[];for(const c of courses)if(!c.cancelled)for(let p=c.start;p<=c.end;p++){const [start,end]=settings.times[p-1].split('-');occupied.push({start:timeMinutes(start),end:timeMinutes(end)});}
 return {withinTerm:true,week,courses,occupied:mergeIntervals(occupied)};
}
export function compareWeek(own,peer,week,{start='08:00',end='22:00',minimum=20}={}){
 const settings=validateSettings(own.settings),from=timeMinutes(start),to=timeMinutes(end);if(from>=to)throw Error('结束时间须晚于开始时间');if(!Number.isInteger(Number(minimum))||minimum<1||minimum>840)throw Error('最短空闲须为1—840分钟');if(!Number.isInteger(week)||week<1||week>settings.totalWeeks)throw Error('请选择自己学期内的一周');
 const first=addDays(settings.startDate,(week-1)*7),days=[];
 for(let i=0;i<7;i++){const date=dateKey(addDays(first,i)),a=coursesOnDate(own,date),b=coursesOnDate(peer,date),free=[];
  if(a.withinTerm&&b.withinTerm){let cursor=from;for(const busy of mergeIntervals([...a.occupied,...b.occupied])){if(busy.end<=from||busy.start>=to)continue;const next=Math.min(to,Math.max(from,busy.start));if(next-cursor>=minimum)free.push({start:formatMinutes(cursor),end:formatMinutes(next),minutes:next-cursor});cursor=Math.max(cursor,Math.min(to,busy.end));}if(to-cursor>=minimum)free.push({start:formatMinutes(cursor),end:formatMinutes(to),minutes:to-cursor});}
  days.push({date,ownWeek:a.week,peerWeek:b.week,known:a.withinTerm&&b.withinTerm,free,own:a.courses,peer:b.courses});
 }
 return {startDate:dateKey(first),days,minimum:Number(minimum),window:{start,end}};
}
export function roomCards(courses,settings,date){const d=typeof date==='string'?parseDate(date):date,week=weekAt(settings.startDate,d);if(week<1||week>settings.totalWeeks)return [];return blocksFor(courses,week,(d.getDay()+6)%7+1,settings.times).map(c=>({...c,date:dateKey(d),time:settings.times[c.start-1].split('-')[0]+'–'+settings.times[c.end-1].split('-')[1]}));}
export function validateDrawBoxes(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!=null&&raw.version!==1||raw.lists!=null&&!Array.isArray(raw.lists))throw Error('抽签盒数据无效');
 if((raw.lists||[]).length>20)throw Error('最多保存20个抽签列表');const ids=new Set();
 const lists=(raw.lists||[]).map(list=>{const id=text(list.id,100),name=text(list.name,40);if(!id||ids.has(id)||!name||!Array.isArray(list.items)||list.items.length>100)throw Error('抽签列表无效');ids.add(id);const items=[...new Set(list.items.map(x=>text(x,100)).filter(Boolean))];return {id,name,items};});
 return {version:1,selectedId:lists.some(x=>x.id===raw.selectedId)?raw.selectedId:lists[0]?.id||'',lists};
}
export function drawItem(items,fill=bytes=>globalThis.crypto.getRandomValues(bytes)){
 if(!Array.isArray(items)||!items.length)throw Error('先添加至少一个选项');if(items.length===1)return items[0];const limit=Math.floor(0x100000000/items.length)*items.length;
 for(let i=0;i<64;i++){const bytes=new Uint32Array(1);fill(bytes);if(bytes[0]<limit)return items[bytes[0]%items.length];}throw Error('随机选择暂未完成，请再试一次');
}
