export const PERSONAL_KEY='course-compass.personalization.v1';
export const DEFAULT_PERSONAL={version:1,visible:true,widget:{style:'glass',content:'course',quote:'留一点时间，给喜欢的事',showInApp:false},items:[]};
export function safeLink(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error();return u.href;}catch{throw Error('快捷入口请输入完整 HTTPS 网址');}}
export function validatePersonal(raw={}){
 const widget=raw.widget||{},items=raw.items||[];
 if(!Array.isArray(items)||items.length>20)throw Error('最多添加20个挂件');
 return {version:1,visible:raw.visible!==false,widget:{style:['glass','pixel','record'].includes(widget.style)?widget.style:'glass',content:['course','date','quote'].includes(widget.content)?widget.content:'course',quote:String(widget.quote||DEFAULT_PERSONAL.widget.quote).slice(0,60),showInApp:widget.showInApp===true},items:items.map((item,i)=>{
  if(!['sticker','note','countdown','link'].includes(item.type))throw Error('挂件类型不支持');
  const text=String(item.text||'').trim();if(!text||text.length>60)throw Error('挂件文字需要1–60字');
  const date=String(item.date||'');if(item.type==='countdown'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00'))||((d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'))(new Date(date+'T12:00:00'))!==date))throw Error('请选择有效日期');
  return {id:String(item.id||'item-'+i).slice(0,80),type:item.type,text,x:Math.max(0,Math.min(100,Number(item.x)||0)),y:Math.max(0,Math.min(100,Number(item.y)||0)),date:item.type==='countdown'?date:'',url:item.type==='link'?safeLink(item.url):''};
 })};
}
export function calendarDays(date,now=new Date()){const toDay=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000;return Math.round(toDay(new Date(date+'T12:00:00'))-toDay(now));}
