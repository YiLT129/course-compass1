import {parseWeeks,validateCourse,validateSettings,validateEnvelope} from './model.js';

export const SCREENSHOT_LIMITS={bytes:20*1024*1024,pixels:24000000,records:150};
export function validateScreenshotGrid(raw={}){
 const grid={left:Number(raw.left??10),right:Number(raw.right??99),top:Number(raw.top??25),bottom:Number(raw.bottom??96),days:Number(raw.days??7),first:Number(raw.first??1),last:Number(raw.last??12)};
 if(![5,7].includes(grid.days)||!Number.isInteger(grid.first)||!Number.isInteger(grid.last)||grid.first<1||grid.last>12||grid.first>grid.last)throw Error('请选择5或7天，并核对截图首末节次');
 if(!['left','right','top','bottom'].every(k=>Number.isFinite(grid[k])&&grid[k]>=0&&grid[k]<=100)||grid.right-grid.left<25||grid.bottom-grid.top<15)throw Error('课程区太小，请重新设置左上和右下边界');
 return grid;
}
const tidy=value=>String(value??'').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').trim();
export function fieldsFromScreenshot(text){
 const lines=tidy(text).split(/[\r\n]+/).map(tidy).filter(Boolean),fields={name:'',location:'',teacher:'',weeks:''},titles=[];
 for(let i=0;i<lines.length;i++){
  let line=lines[i].replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1');
  const week=line.match(/((?:第)?\d+(?:\s*[-–—~至]\s*\d+)?(?:\s*[,，、]\s*\d+)*)\s*周(?:\s*[（(]?[单双](?:周)?[）)]?)?/);
  if(week){try{fields.weeks=parseWeeks(week[0]).join(',');}catch{}line=line.replace(week[0],'').trim();}
  if(/^(?:第\s*)?\d+(?:\s*[-–—~]\s*\d+)?\s*节$/.test(line)||/^\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?$/.test(line)||/^(?:星期|周)[一二三四五六日天]$/.test(line))continue;
  const room=line.match(/^(?:教室|地点|上课地点)\s*[:：]?\s*(.+)$/);if(room){fields.location=room[1].trim();continue;}
  const teacher=line.match(/^(?:教师|老师|任课教师)\s*[:：]?\s*(.+)$/);if(teacher){fields.teacher=teacher[1].trim();continue;}
  if(/^[A-Za-z\d]{1,8}\s*[-—–]\s*[A-Za-z\d-]{1,12}$/.test(line)){
   fields.location=line.replace(/[—–\s]/g,m=>m===' '?'':'-');
   if(i+1<lines.length&&/^\d{1,2}$/.test(lines[i+1])&&/-\d{1,2}$/.test(fields.location))fields.location+=lines[++i];
   continue;
  }
  if(/^(?:[A-Za-z]{1,4}\d{2,6}(?:-\d+)?|\d{2,4}室)$/.test(line)){fields.location=line;continue;}
  if(fields.location&&titles.length&&!fields.teacher&&/^[\u3400-\u9fff]{2,4}$/.test(line)){fields.teacher=line;continue;}
  if(!line||/^[\d\s.,、:：/\-—–]+$/.test(line))continue;
  titles.push(line);
 }
 fields.name=titles.join('').slice(0,100);return fields;
}
export function screenshotEnvelope(records,settings,scopeWeeks){
 const checked=validateSettings(settings),scope=parseWeeks(scopeWeeks);if(scope.some(w=>w>checked.totalWeeks))throw Error('截图导入周次超出本学期范围');
 if(!Array.isArray(records)||!records.length||records.length>SCREENSHOT_LIMITS.records)throw Error('请先识别或添加至少一条课程');
 const courses=records.map((record,index)=>{const c=validateCourse({...record,id:record.id||'screenshot-'+index,weeks:record.weeks||scope},index);if(c.weeks.some(w=>!scope.includes(w)))throw Error(`${c.name}：课程周次须在本次导入周次内`);return c;});
 const value=validateEnvelope({version:1,settings:checked,courses,demo:false});
 return {...value,adapter:'截图识别 · 已核对',sourceScope:{type:'week',weeks:scope}};
}
export function preserveScreenshotOutside(existing,value,windowRaw){
 const window=validateScreenshotGrid(windowRaw),affected=new Set(parseWeeks(value.sourceScope?.weeks));
 const outside=[];
 for(const course of existing||[]){
  const weeks=course.weeks.filter(w=>affected.has(w));if(!weeks.length)continue;
  if(course.day>window.days||course.end<window.first||course.start>window.last){outside.push({...course,weeks});continue;}
  if(course.start<window.first)outside.push({...course,id:String(course.id).slice(0,85)+'@keep-'+course.start+'-'+(window.first-1),weeks,end:window.first-1});
  if(course.end>window.last)outside.push({...course,id:String(course.id).slice(0,85)+'@keep-'+(window.last+1)+'-'+course.end,weeks,start:window.last+1});
 }
 return {...value,courses:[...outside,...value.courses],warnings:[...(value.warnings||[]),`截图仅更新所选周次的周一至周${window.days===5?'五':'日'}、第${window.first}–${window.last}节；窗口外已有课程保留。`]};
}

// Flat coloured cards are located independently of their text. Monochrome or
// textured timetables fall back to conservative, editable single-period rows.
export function screenshotRegions(pixels,width,height,gridRaw){
 const grid=validateScreenshotGrid(gridRaw),x0=Math.round(width*grid.left/100),x1=Math.round(width*grid.right/100),y0=Math.round(height*grid.top/100),y1=Math.round(height*grid.bottom/100),cw=(x1-x0)/grid.days,rh=(y1-y0)/(grid.last-grid.first+1),regions=[];
 for(let day=1;day<=grid.days;day++){
  const left=Math.round(x0+(day-1)*cw+cw*.06),right=Math.round(x0+day*cw-cw*.06),hist=new Map();
  for(let y=y0;y<y1;y+=4)for(let x=left;x<right;x+=4){const p=(y*width+x)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];if((r+g+b)/3<125)continue;const key=[r,g,b].map(n=>Math.floor(n/16)).join(',');hist.set(key,(hist.get(key)||0)+1);}
  const dominant=[...hist].sort((a,b)=>b[1]-a[1])[0]?.[0].split(',').map(n=>Number(n)*16+8)||[248,248,248],mask=[];
  for(let y=y0;y<y1;y++){
   let count=0,changed=0;for(let x=left;x<right;x+=3){const p=(y*width+x)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];count++;if((r+g+b)/3<110)continue;const distance=Math.abs(r-dominant[0])+Math.abs(g-dominant[1])+Math.abs(b-dominant[2]);if(distance>32&&Math.max(r,g,b)-Math.min(r,g,b)>18)changed++;}
   mask.push(changed/Math.max(1,count)>.42);
  }
  const holes=Math.min(10,Math.round(rh*.1));for(let i=1;i<mask.length;i++)if(!mask[i]&&mask[i-1]){let j=i;while(j<mask.length&&!mask[j]&&j-i<=holes)j++;if(mask[j]&&j-i<=holes)for(let k=i;k<j;k++)mask[k]=true;}
  for(let i=0;i<mask.length;i++){if(!mask[i])continue;let end=i;while(end+1<mask.length&&mask[end+1])end++;if(end-i>rh*.4){const startPeriod=Math.max(grid.first,grid.first+Math.floor(i/rh+.15)),endPeriod=Math.min(grid.last,grid.first+Math.ceil((end+1)/rh-.15)-1);if(endPeriod>=startPeriod&&endPeriod-startPeriod<5)regions.push({day,start:startPeriod,end:endPeriod,left,top:y0+i,width:right-left,height:end-i+1});}i=end;}
 }
 return {regions,rectangle:{left:x0,top:y0,width:x1-x0,height:y1-y0},columnWidth:cw,rowHeight:rh,grid};
}

export function screenshotWordsToRecords(words,day,{first=1,last=12,height},weeks){
 const rows=new Map(),rh=height/(last-first+1);
 for(const word of words||[]){const text=tidy(word.text);if(!text||!word.bbox)continue;const center=(Number(word.bbox.y0)+Number(word.bbox.y1))/2,period=Math.max(first,Math.min(last,first+Math.floor(center/rh)));if(!rows.has(period))rows.set(period,[]);rows.get(period).push(word);}
 return [...rows].sort((a,b)=>a[0]-b[0]).map(([period,list])=>{list.sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);const lines=[];let baseline=-1000;for(const word of list){if(word.bbox.y0-baseline>12){lines.push([]);baseline=word.bbox.y0;}lines.at(-1).push(word.text);}return {...fieldsFromScreenshot(lines.map(line=>line.join(' ')).join('\n')),day,start:period,end:period,weeks};}).filter(c=>c.name);
}
