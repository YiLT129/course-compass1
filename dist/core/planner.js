export const PLANNER_KEY='course-compass.planner.v1';
export const MAX_PLANNER_ENTRIES=100;
export const PLANNER_GRACE_MS=60*60*1000;
const MAX_AT=4102531200000; // Covers all local dates through 2099.
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const byTime=(a,b)=>a.at-b.at||(a.id<b.id?-1:a.id>b.id?1:0);

export function validatePlanner(raw){
 if(!plain(raw)||raw.version!==1||!Array.isArray(raw.entries))throw Error('日程数据格式无效');
 if(raw.entries.length>MAX_PLANNER_ENTRIES)throw Error('最多保存 100 条日程，请先清理旧记录');
 const ids=new Set();
 const entries=raw.entries.map(row=>{
  if(!plain(row)||typeof row.id!=='string'||!/^[a-z0-9-]{1,64}$/.test(row.id))throw Error('日程编号无效');
  if(ids.has(row.id))throw Error('日程编号重复');
  ids.add(row.id);
  if(!Number.isSafeInteger(row.at)||row.at<=0||row.at>=MAX_AT)throw Error('日程时间无效');
  const title=typeof row.title==='string'?row.title.trim():'';
  if(!title||title.length>80||/[\x00-\x1f\x7f]/.test(title))throw Error('日程标题须为 1–80 个可见字符');
  const note=row.note===undefined?'':row.note;
  if(typeof note!=='string'||note.length>400)throw Error('日程备注最多 400 个字符');
  if(row.historical!==undefined&&typeof row.historical!=='boolean')throw Error('日程历史状态无效');
  return {id:row.id,at:row.at,title,note:note.trim(),...(row.historical?{historical:true}:{})};
 });
 return {version:1,entries:entries.sort(byTime)};
}

export function readPlanner(storage=localStorage){
 const raw=storage.getItem(PLANNER_KEY);
 return raw===null?{version:1,entries:[]}:validatePlanner(JSON.parse(raw));
}

export function parsePlannerTime(date,time,originalAt){
 if(!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(date))throw Error('请选择有效日期');
 if(!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))throw Error('请选择有效时间');
 const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
 if(Number.isSafeInteger(originalAt)){
  const original=new Date(originalAt);
  if(original.getFullYear()===year&&original.getMonth()===month-1&&original.getDate()===day&&original.getHours()===hour&&original.getMinutes()===minute)return originalAt;
 }
 const local=new Date(year,month-1,day,hour,minute);
 if(local.getFullYear()!==year||local.getMonth()!==month-1||local.getDate()!==day)throw Error('请选择有效日期');
 if(local.getHours()!==hour||local.getMinutes()!==minute)throw Error('所选钟点在当前时区不存在');
 return local.getTime();
}

export function upsertPlannerEntry(plan,row,now=Date.now()){
 const candidate=validatePlanner({version:1,entries:[{...row,historical:false}]}).entries[0];
 if(candidate.at<=now)throw Error('请选择当前时间之后的日期和时间');
 return validatePlanner({version:1,entries:[...plan.entries.filter(x=>x.id!==candidate.id),candidate]});
}

export function archiveRestoredPlans(plan,now=Date.now()){
 const {version,entries}=validatePlanner(plan);
 return {version,entries:entries.map(row=>row.at<=now?{...row,historical:true}:row)};
}

export const plannerEntryKey=row=>row.id+':'+row.at;

export function duePlannerEntries(rows,openedAt,now,seen){
 return rows.filter(row=>!row.historical&&row.at>openedAt&&row.at<=now&&now-row.at<=PLANNER_GRACE_MS&&!seen.has(plannerEntryKey(row))).sort(byTime);
}
