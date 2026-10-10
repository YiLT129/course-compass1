/* Runs in the school page, including allowed school frames. No credentials or remote upload. */
(function(){
 if(window.__courseCompassCollector?.version===5)return;
 function find(value,depth=0){
  if(!value||typeof value!=='object'||depth>4)return null;
  if(Array.isArray(value.kbList))return {kbList:value.kbList};
  if(Array.isArray(value)&&value.length&&value.every(row=>row&&typeof row==='object'&&row.kcmc&&(row.jcs||row.jc)&&row.xqj))return {kbList:value};
  for(const key of ['data','result','rows','kbxx']){const found=find(value[key],depth+1);if(found)return found;}
  return null;
 }
 function recipe(method,url,body){try{
  const u=new URL(url,window.location.href);method=String(method||'GET').toUpperCase();
  if(u.origin!==window.location.origin||u.hostname!==(window.__courseCompassSchoolHost||'jw.gzist.edu.cn')||!/^\/jwglxt\/kbcx\//.test(u.pathname)||!['GET','POST'].includes(method)||u.username||u.password)return null;
  if(body!=null&&typeof body!=='string'&&!(body instanceof URLSearchParams))return null;
  const text=body==null?null:String(body);if(text&&text.length>20000)return null;
  return {method,url:u.href,body:text};
 }catch{return null;}}
 function sourceScope(blueprint,rows){
  try{
   const url=new URL(blueprint?.url||window.location.href,window.location.href);
   const params=new URLSearchParams(url.search);for(const [key,value] of new URLSearchParams(blueprint?.body||''))params.set(key,value);
   for(const key of ['zc','dqzc','week']){const value=params.get(key);if(/^[1-9]\d?$/.test(value||'')&&Number(value)<=60)return {type:'week',weeks:[Number(value)]};}
   if(/\/xskbcx_cxXsKb\.html$/.test(url.pathname)&&params.has('xnm')&&params.has('xqm'))return {type:'term'};
   const text=window.document?.body?.innerText||'';
   const visibleWeek=text.match(/第\s*(\d{1,2})\s*周\s*20\d{2}[-/]\d{1,2}[-/]\d{1,2}\s*\/\s*20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);
   if(visibleWeek&&Number(visibleWeek[1])>=1&&Number(visibleWeek[1])<=60)return {type:'week',weeks:[Number(visibleWeek[1])]};
   const single=rows.map(row=>String(row.zcd||'').trim().match(/^第?(\d{1,2})周?$/)?.[1]);
   if(single.length&&single.every(value=>value&&value===single[0])&&Number(single[0])>=1&&Number(single[0])<=60)return {type:'week',weeks:[Number(single[0])]};
  }catch{}
  return {type:'unknown'};
 }
 function post(value){try{window.CourseCompassCapture?.postMessage(JSON.stringify(value));}catch{}}
 const nativeFetch=window.fetch?.bind(window);
 const fields=['kcmc','jcs','jc','xqj','zcd','xm','jsxm','cdmc','bz'];
 const collector={version:5,data:null,recipe:null,syncStatus:'idle',requests:0,
  accept(value,blueprint){const found=find(value);if(!found?.kbList.length)return false;
   this.data={sourceScope:sourceScope(blueprint,found.kbList),kbList:found.kbList.map(row=>Object.fromEntries(fields.filter(key=>row[key]!=null).map(key=>[key,row[key]])))};
   this.recipe=blueprint||null;
   post({type:'timetable',data:this.data,query:this.recipe});return true;
  },
  read(){if(this.data?.kbList.length)return this.data;
   for(const key of ['kbxx','kbData','kbList','timetableData','data','result']){try{if(this.accept(window[key],null))break;}catch{}}
   return this.data;
  },
  report(readResult=false){const data=this.read();if(data){data.sourceScope=sourceScope(this.recipe,data.kbList);post({type:'timetable',data,query:this.recipe,readResult});}else post({type:'status',requests:this.requests});return data;},
  async obtain(force=false){
   if(this.querying)return null;const previous=this.read(),previousRecipe=this.recipe;
   if(!force&&previous?.sourceScope?.type==='term')return this.report(true);
   const value=key=>{try{const node=window.document?.querySelector('[name="'+key+'"],#'+key);const raw=node?.value??window[key]?.value??window[key];if(typeof raw==='string'||typeof raw==='number')return String(raw);const u=new URL(this.recipe?.url||window.location.href,window.location.href);return new URLSearchParams(this.recipe?.body||'').get(key)||u.searchParams.get(key)||'';}catch{return '';}};
   const year=value('xnm'),rawTerm=value('xqm'),term=({'1':'3','2':'12'}[rawTerm]||rawTerm);
   if(!/^20\d{2}$/.test(year)||!['3','12','16'].includes(term)){post({type:'status',reason:'未找到页面所选学年和学期，请进入学期课表并重新查询。',failed:force,requests:this.requests});return force?null:this.report(true);}
   this.querying=true;post({type:'status',reason:'正在请求 '+year+' 学年、第 '+rawTerm+' 学期的完整课表…',requests:this.requests});
   try{
    const url=new URL('/jwglxt/kbcx/xskbcx_cxXsKb.html',window.location.href);
    const menu=new URL(window.location.href).searchParams.get('gnmkdm');if(menu&&/^[A-Za-z0-9]+$/.test(menu))url.searchParams.set('gnmkdm',menu);
    const body=new URLSearchParams({xnm:year,xqm:term,kzlx:'ck'}).toString();this.requests++;
    await this.replay({method:'POST',url:url.href,body});return this.report(true);
   }catch{this.data=previous;this.recipe=previousRecipe;if(force){post({type:'status',failed:true,reason:'刷新失败，未获取新的课表；请重新登录或在学校页面查询后读取。旧课表已保留。',requests:this.requests});this.syncStatus='login';return null;}post({type:'status',reason:'整学期查询未返回数据，将核对已捕获课表的范围；不会覆盖其他周。',requests:this.requests});return this.report(true);}
   finally{this.querying=false;}
  },
  async replay(value){const safe=recipe(value?.method,value?.url,value?.body);if(!safe)throw Error('同步地址无效，请重新查询课表');
   this.data=null;this.syncStatus='loading';
   const controller=typeof AbortController==='function'&&typeof setTimeout==='function'?new AbortController():null;const timer=controller?setTimeout(()=>controller.abort(),9000):null;
   try{const response=await nativeFetch(safe.url,{signal:controller?.signal,method:safe.method,body:safe.method==='POST'?safe.body:undefined,credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'}});
    if(!response.ok||!this.accept(await response.json(),safe))throw Error();this.syncStatus='ready';return this.data;
   }catch{this.syncStatus='login';throw Error('会话已失效或查询没有返回课表，请重新登录并查询');}finally{if(timer!=null)clearTimeout(timer);}
  }
 };
 window.__courseCompassCollector=collector;
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
 XMLHttpRequest.prototype.open=function(method,url,...args){this.__compassUrl=String(url);this.__compassMethod=method;return open.call(this,method,url,...args);};
 XMLHttpRequest.prototype.send=function(...args){const blueprint=recipe(this.__compassMethod,this.__compassUrl,args[0]);
  this.addEventListener('load',()=>{try{if(!/kbcx|kbxx|timetable/i.test(this.__compassUrl||''))return;collector.requests++;
   collector.accept(this.responseType==='json'?this.response:JSON.parse(this.responseText),blueprint);
  }catch{}});return send.apply(this,args);
 };
 if(window.fetch){const original=window.fetch;window.fetch=async function(...args){const response=await original.apply(this,args);
  if(/kbcx|kbxx|timetable/i.test(String(args[0]?.url||args[0]))){
   collector.requests++;
   let body=args[1]?.body,method=args[1]?.method||args[0]?.method||'GET';
   if(body===undefined&&typeof args[0]?.clone==='function'){try{body=await args[0].clone().text();}catch{}}
   const blueprint=recipe(method,args[0]?.url||args[0],body);
   response.clone().json().then(value=>collector.accept(value,blueprint)).catch(()=>{});
  }return response;
 };}
 if(window.CourseCompassCapture)window.CourseCompassCapture.onmessage=event=>{try{const command=JSON.parse(event.data);if(command.type==='read')collector.obtain(command.force===true);}catch{}};
 post({type:'ready'});collector.read();
})();
