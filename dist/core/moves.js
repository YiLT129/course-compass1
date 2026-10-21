import {addDays,dateKey,parseDate,weekAt} from './model.js';
import {courseFingerprint} from './overrides.js';

export const MOVES_KEY='course-compass.moves.v1';
const MAX_MOVES=12000;
const key=e=>JSON.stringify([e.schoolId,e.startDate,e.fingerprint,e.sourceId||'',e.week,e.period]);
// Prefer the selected source record while it exists. After a school refresh,
// semantic fallback is allowed only when one source ID can own this period.
export function resolveMoveSource(entry,courses){
 const candidates=courses.filter(c=>courseFingerprint(c)===entry.fingerprint&&c.weeks.includes(entry.week)&&c.start<=entry.period&&c.end>=entry.period);
 if(entry.sourceId&&courses.some(c=>c.id===entry.sourceId))return candidates.some(c=>c.id===entry.sourceId)?entry.sourceId:null;
 const ids=[...new Set(candidates.map(c=>c.id))];return ids.length===1?ids[0]:null;
}
function belongsTo(entry,course,sourceCourses){if(entry.fingerprint!==courseFingerprint(course))return false;if(entry.sourceId===course.id)return true;if(sourceCourses)return resolveMoveSource(entry,sourceCourses)===course.id;return !entry.sourceId;}
export function validateMoves(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>MAX_MOVES)throw Error('调课记录格式无效');
 const seen=new Set(),entries=raw.entries.map(item=>{
  if(!item||typeof item!=='object')throw Error('调课记录格式无效');
  const schoolId=String(item.schoolId??''),startDate=String(item.startDate??'');if(!/^[a-z0-9._:-]{1,100}$/i.test(schoolId))throw Error('调课学校标识无效');parseDate(startDate);if(weekAt(startDate,parseDate(startDate))!==1||(parseDate(startDate).getDay()+6)%7!==0)throw Error('调课学期起点须为周一');
  let parts;try{parts=JSON.parse(item.fingerprint);}catch{throw Error('调课课程标识无效');}if(!Array.isArray(parts)||parts.length!==4||typeof parts[0]!=='string'||!parts[0]||parts[0].length>100||typeof parts[1]!=='string'||parts[1].length>100||!Number.isInteger(parts[2])||parts[2]<1||parts[2]>7||typeof parts[3]!=='boolean')throw Error('调课课程标识无效');
  const fingerprint=courseFingerprint({name:parts[0],teacher:parts[1],day:parts[2],personal:parts[3]}),week=Number(item.week),period=Number(item.period),targetDay=Number(item.targetDay),targetPeriod=Number(item.targetPeriod),updatedAt=Number(item.updatedAt??0);
  if(!Number.isInteger(week)||week<1||week>60||!Number.isInteger(period)||period<1||period>12||!Number.isInteger(targetDay)||targetDay<1||targetDay>7||!Number.isInteger(targetPeriod)||targetPeriod<1||targetPeriod>12||!Number.isFinite(updatedAt)||updatedAt<0)throw Error('调课日期或节次无效');
  if(targetDay===parts[2]&&targetPeriod===period)throw Error('调课目标与原安排相同');
  if(item.sourceId!=null&&(typeof item.sourceId!=='string'||!item.sourceId||item.sourceId.length>120))throw Error('调课源记录标识无效');
  const entry={schoolId,startDate,fingerprint,...(item.sourceId?{sourceId:item.sourceId}:{}),week,period,targetDay,targetPeriod,updatedAt},identity=key(entry);if(seen.has(identity))throw Error('同一次课程有重复调课记录');seen.add(identity);return entry;
 });return {version:1,entries};
}
export function readMoves(storage=globalThis.localStorage){const raw=storage?.getItem(MOVES_KEY);if(!raw)return {version:1,entries:[]};try{return validateMoves(JSON.parse(raw));}catch(error){throw Error('本机调课记录无法读取：'+error.message);}}
export function saveMoves(raw,storage=globalThis.localStorage){const next=validateMoves(raw);storage.setItem(MOVES_KEY,JSON.stringify(next));return next;}
export function moveBlock(raw,course,settings,{schoolId,week,sourceStart,sourceEnd,targetDay,targetStart,scope='once',sourceCourses}){
 const state=validateMoves(raw);if(!['once','following'].includes(scope))throw Error('调课范围无效');
 if(!Number.isInteger(week)||week<1||week>settings.totalWeeks||!course.weeks.includes(week)||!Number.isInteger(sourceStart)||!Number.isInteger(sourceEnd)||sourceStart<course.start||sourceEnd>course.end||sourceStart>sourceEnd)throw Error('请选择当前周真实排课中的课块');
 const count=sourceEnd-sourceStart+1;if(!Number.isInteger(targetDay)||targetDay<1||targetDay>7||!Number.isInteger(targetStart)||targetStart<1||targetStart+count-1>12)throw Error('目标节次放不下这个课块');
 const fingerprint=courseFingerprint(course),weeks=scope==='following'?course.weeks.filter(w=>w>=week&&w<=settings.totalWeeks):[week],next=[...state.entries];
 for(const w of weeks)for(let p=sourceStart;p<=sourceEnd;p++){
  const entry={schoolId,startDate:settings.startDate,fingerprint,sourceId:course.id,week:w,period:p,targetDay,targetPeriod:targetStart+p-sourceStart,updatedAt:Date.now()};for(let i=next.length-1;i>=0;i--){const e=next[i];if(e.schoolId===schoolId&&e.startDate===settings.startDate&&e.week===w&&e.period===p&&belongsTo(e,course,sourceCourses))next.splice(i,1);}if(entry.targetDay!==course.day||entry.targetPeriod!==p)next.push(entry);
 }
 return validateMoves({version:1,entries:next});
}
export function resetMovedBlock(raw,course,settings,{schoolId,week,sourceStart,sourceEnd,scope='once',sourceCourses}){
 if(!['once','following'].includes(scope)||!Number.isInteger(week)||week<1||week>settings.totalWeeks||!Number.isInteger(sourceStart)||!Number.isInteger(sourceEnd)||sourceStart<course.start||sourceEnd>course.end||sourceStart>sourceEnd)throw Error('恢复调课的范围无效');
 const state=validateMoves(raw);return validateMoves({version:1,entries:state.entries.filter(e=>!(e.schoolId===schoolId&&e.startDate===settings.startDate&&belongsTo(e,course,sourceCourses)&&(scope==='following'?e.week>=week:e.week===week)&&e.period>=sourceStart&&e.period<=sourceEnd))});
}
// Move overlays are applied after room/cancellation overlays. Original input is
// never changed; cancelled periods and local rooms travel with their source.
export function applyMoves(courses,settings,raw,schoolId){
 const state=validateMoves(raw),byCourse=new Map();for(const entry of state.entries){if(entry.schoolId!==schoolId||entry.startDate!==settings.startDate||entry.week>settings.totalWeeks)continue;const sourceId=resolveMoveSource(entry,courses);if(!sourceId)continue;const identity=JSON.stringify([sourceId,entry.fingerprint]);if(!byCourse.has(identity))byCourse.set(identity,new Map());const changes=byCourse.get(identity),slot=entry.week+'@'+entry.period;changes.set(slot,changes.has(slot)?null:entry);}
 if(!byCourse.size)return courses;
 return courses.flatMap(course=>{
  const changes=byCourse.get(JSON.stringify([course.id,courseFingerprint(course)]));if(!changes)return [course];
  const untouched=[],changed=[];for(const week of course.weeks){let found=false;for(let p=course.start;p<=course.end;p++)if(changes.get(week+'@'+p)){found=true;break;}if(!found){untouched.push(week);continue;}
   let segment=null;for(let p=course.start;p<=course.end;p++){
    const entry=changes.get(week+'@'+p);if(entry){if(segment){changed.push(segment);segment=null;}const delta=entry.targetPeriod-p,sourceDay=course.day;changed.push({...course,id:'moved~'+course.id+'~'+week+'~'+entry.targetDay+'~'+delta,originalId:course.id,day:entry.targetDay,start:entry.targetPeriod,end:entry.targetPeriod,weeks:[week],sourceStart:course.sourceStart??course.start,sourceEnd:course.sourceEnd??course.end,sourceWeeks:course.sourceWeeks??course.weeks,move:{week,sourceDay,sourcePeriod:p,delta,sourceDate:dateKey(addDays(settings.startDate,(week-1)*7+sourceDay-1))}});}
    else if(segment)segment.end=p;else segment={...course,start:p,end:p,weeks:[week],sourceStart:course.sourceStart??course.start,sourceEnd:course.sourceEnd??course.end,sourceWeeks:course.sourceWeeks??course.weeks};
   }if(segment)changed.push(segment);
  }return [...(untouched.length?[{...course,weeks:untouched}]:[]),...changed];
 });
}
export function moveConflicts(courses,settings,course,context){
 const {week,targetDay,targetStart,sourceStart,sourceEnd}=context,targetEnd=targetStart+sourceEnd-sourceStart;
 return courses.filter(c=>{if(c.cancelled||!c.weeks.includes(week)||c.day!==targetDay||c.start>targetEnd||c.end<targetStart)return false;for(let p=Math.max(c.start,targetStart);p<=Math.min(c.end,targetEnd);p++){const sameSource=(c.originalId||c.id)===course.id,sourcePeriod=p-(c.move?.delta||0);if(!sameSource||sourcePeriod<sourceStart||sourcePeriod>sourceEnd)return true;}return false;});
}
