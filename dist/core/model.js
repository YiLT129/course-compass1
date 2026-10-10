export const SCHEMA_VERSION = 1;
export const COLORS = ['mint','blue','peach','purple','rose','yellow'];
export const LEGACY_TIMES = ['08:00-08:45','08:55-09:40','10:00-10:45','10:55-11:40','14:00-14:45','14:55-15:40','16:00-16:45','16:55-17:40','19:00-19:45','19:55-20:40','20:50-21:35','21:45-22:30'];
export const DEFAULT_TIMES = ['08:20-09:05','09:15-10:00','10:20-11:05','11:15-12:00','14:00-14:45','14:55-15:40','16:00-16:45','16:55-17:40','18:40-19:25','19:35-20:00','20:20-21:00','21:00-21:40'];
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function parseDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw Error('请输入有效日期'); const [y,m,d] = value.split('-').map(Number); const dt = new Date(y,m-1,d,12); if (dateKey(dt)!==value) throw Error('日期不存在'); return dt; }
export function monday(value) { const date = typeof value==='string' ? parseDate(value) : new Date(value); date.setDate(date.getDate()-((date.getDay()+6)%7)); date.setHours(12,0,0,0); return date; }
export function addDays(value, days) { const d = typeof value==='string' ? parseDate(value) : new Date(value); d.setDate(d.getDate()+days); return d; }
export function weekAt(startDate, date = new Date()) { const start=monday(startDate); const now=monday(date); return Math.round((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/604800000)+1; }
export function parseWeeks(input) {
  if (Array.isArray(input)) { const weeks=[...new Set(input.map(Number))].sort((a,b)=>a-b); if (!weeks.length || weeks.some(x=>!Number.isInteger(x)||x<1||x>60)) throw Error('周次须在 1—60 之间'); return weeks; }
  const text=String(input??'').trim().replace(/[，、;；]/g,',').replace(/[–—~～至]/g,'-').replace(/\s/g,'');
  if (!text) throw Error('请填写上课周次');
  const all=[];
  for (const segment of text.split(',')) {
    const match=segment.match(/^(?:第)?(\d+)(?:-(?:第)?(\d+))?(?:周)?(?:[（(]?(单|双)(?:周)?[）)]?)?$/);
    if (!match) throw Error(`无法识别周次：${segment}`);
    const a=Number(match[1]),b=Number(match[2]||match[1]);
    if(a<1||b>60||b<a) throw Error('周次须是 1—60 内的递增区间');
    for(let i=a;i<=b;i++) if(!match[3]||(match[3]==='单'?i%2===1:i%2===0)) all.push(i);
  }
  return parseWeeks(all);
}
export function validateCourse(raw, index=0) {
  if (!raw || typeof raw !== 'object') throw Error('课程格式无效');
  const name=String(raw.name??'').trim().slice(0,100);
  const day=Number(raw.day),start=Number(raw.start),end=Number(raw.end);
  if(!name) throw Error('课程名称不能为空');
  if(!Number.isInteger(day)||day<1||day>7) throw Error(`${name}：星期须在 1—7 之间`);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>12||end<start) throw Error(`${name}：节次须在 1—12 之间`);
  const weeks=parseWeeks(raw.weeks);
  return {id:String(raw.id||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${index}-${Math.random()}`).slice(0,120),name,day,start,end,weeks,location:String(raw.location??'').slice(0,160),teacher:String(raw.teacher??'').slice(0,100),note:String(raw.note??'').slice(0,500),color:COLORS.includes(raw.color)?raw.color:COLORS[index%COLORS.length]};
}
export function validateSettings(raw={}) {
  const startDate=raw.startDate || '2026-09-07'; parseDate(startDate);
  if(dateKey(monday(startDate))!==startDate) throw Error('第一周开始日期请选择周一');
  const totalWeeks=Number(raw.totalWeeks??20);
  if(!Number.isInteger(totalWeeks)||totalWeeks<1||totalWeeks>60) throw Error('学期周数须在 1—60 之间');
  const times=raw.times??DEFAULT_TIMES;
  if(!Array.isArray(times)||times.length!==12) throw Error('请填写 12 个节次的时间');
  let lastEnd=-1;
  for(const time of times) { const m=String(time).match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/); if(!m) throw Error('时间格式为 08:20-09:05'); const start=Number(m[1])*60+Number(m[2]),end=Number(m[3])*60+Number(m[4]); if(start>=end||start<lastEnd) throw Error('各节次时间须递增，且不能重叠'); lastEnd=end; }
  return {startDate,totalWeeks,times:times.map(String),term:String(raw.term||'我的学期').slice(0,80)};
}
export function validateEnvelope(raw) {
  if(!raw||raw.version!==SCHEMA_VERSION||!Array.isArray(raw.courses)) throw Error('不是受支持的课表备份（version: 1）');
  if(raw.courses.length>1000) throw Error('课程数量超过 1000 条');
  const courses=raw.courses.map(validateCourse); const ids=new Set(); for(const c of courses) { if(ids.has(c.id)) c.id=globalThis.crypto.randomUUID(); ids.add(c.id); }
  return {version:SCHEMA_VERSION,courses,settings:validateSettings(raw.settings),demo:raw.demo===true};
}
export function conflicts(courses) { const pairs=[]; for(let i=0;i<courses.length;i++) for(let j=i+1;j<courses.length;j++) { const a=courses[i],b=courses[j]; if(a.day===b.day&&a.start<=b.end&&b.start<=a.end&&a.weeks.some(w=>b.weeks.includes(w))) pairs.push([a,b]); } return pairs; }
export function coursesFor(courses,week,day) { return courses.filter(c=>c.weeks.includes(week)&&(day==null||c.day===day)).sort((a,b)=>a.day-b.day||a.start-b.start||a.name.localeCompare(b.name)); }
export function toICS(courses,settings) {
 const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp=(date,time)=>{const [h,m]=time.split(':').map(Number);return new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate(),h-8,m)).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');};
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Course Compass//CN','CALSCALE:GREGORIAN','X-WR-TIMEZONE:Asia/Shanghai'];
 for(const c of courses) for(const week of c.weeks) { const d=addDays(settings.startDate,(week-1)*7+c.day-1); const start=settings.times[c.start-1].split('-')[0],end=settings.times[c.end-1].split('-')[1]; lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(c.id)}-${week}@course-compass`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${stamp(d,start)}`,`DTEND:${stamp(d,end)}`,`SUMMARY:${esc(c.name)}`,`LOCATION:${esc(c.location)}`,`DESCRIPTION:${esc([c.teacher,c.note].filter(Boolean).join(' · '))}`,'END:VEVENT'); }
 lines.push('END:VCALENDAR'); return lines.map(line=>{let folded='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>75){folded+='\r\n ';bytes=1;}folded+=ch;bytes+=size;}return folded;}).join('\r\n');
}
