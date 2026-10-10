const number=value=>{if(value==null||String(value).trim()==='')return null;const text=String(value).trim();if(!/^\d+(?:\.\d+)?$/.test(text))return null;const n=Number(text);return Number.isFinite(n)?n:null;};
export function parseGrades(raw){
 if(!raw||!/^20\d{2}$/.test(String(raw.year))||!['3','12','16'].includes(String(raw.term)))throw Error('成绩学期无效');
 const pageSnapshot=raw.source==='school-page'&&raw.coverage==='loaded-page'&&raw.scopeVerified===true&&raw.items?.length>0;
 if((raw.complete!==true&&!pageSnapshot)||!Array.isArray(raw.items)||raw.items.length>2000)throw Error('成绩数据不完整，请重新读取完整学期成绩');
 if(raw.verified!==true||(raw.source!=='school-query'&&!pageSnapshot))throw Error('尚未核实学校成绩查询结果，原有成绩已保留');
 const year=String(raw.year),term=String(raw.term),normalTerm=v=>({'1':'3','2':'12'}[String(v)]||String(v));
 const courses=raw.items.map((row,i)=>{
  if(!row||typeof row!=='object'||!String(row.kcmc||'').trim())throw Error(`第${i+1}条成绩缺少课程名称，未保存任何数据`);
  if(row.xnm!=null&&String(row.xnm)!==year||row.xqm!=null&&normalTerm(row.xqm)!==term)throw Error('学校返回了其他学期的成绩，未覆盖当前学期');
  const credit=number(row.xf),point=number(row.jd);if(credit!=null&&credit>100||point!=null&&point>10)throw Error('学分或绩点超出可识别范围');
  return {id:String(row.jxb_id||row.kch_id||'')+'-'+i,name:String(row.kcmc).trim().slice(0,100),score:String(row.cj??'').trim().slice(0,40),credit,point,nature:String(row.ksxzmc||row.ksxz||'').slice(0,50),courseCode:String(row.kch_id||row.kch||'').slice(0,80)};
 });
 const known=courses.filter(c=>c.score&&c.credit>0&&c.point!=null),credits=known.reduce((sum,c)=>sum+c.credit,0),missing=courses.filter(c=>c.score&&c.credit!==0&&(c.credit==null||c.point==null)).length;
 const seen=new Set(),duplicates=courses.some(c=>{const key=c.courseCode||c.name;if(seen.has(key))return true;seen.add(key);return false;});
 const first=raw.items.find(r=>r.xh||r.xm)||{};
 return {version:1,verified:true,coverage:pageSnapshot?'loaded-page':'full-term',year,term,courses,profile:{name:String(first.xm||'').slice(0,100),studentId:String(first.xh||'').slice(0,100)},summary:{gpa:credits?known.reduce((sum,c)=>sum+c.credit*c.point,0)/credits:null,credits,count:known.length,missing,duplicates},updatedAt:new Date().toISOString()};
}
