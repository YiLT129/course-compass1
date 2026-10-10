import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/collector.js',import.meta.url),'utf8');
test('采集器只捕获课表请求，重复注入不会重复封装',async()=>{
 class XHR{open(method,url){this.url=url;}send(){}addEventListener(name,fn){this.loaded=fn;}}
 const response={kbList:[{kcmc:'测试',xqj:1,jcs:'1-2',zcd:'1-2'}]};let calls=0;
 const window={fetch:async()=>{calls++;return {clone:()=>({json:async()=>response})};}};
 const context=vm.createContext({window,XMLHttpRequest:XHR});vm.runInContext(source,context);const original=XHR.prototype.send;vm.runInContext(source,context);assert.equal(XHR.prototype.send,original);
 const ignored=new XHR();ignored.open('GET','/personal/profile');ignored.send();ignored.responseText=JSON.stringify(response);ignored.loaded();assert.equal(window.__courseCompassCollector.data,null);
 const request=new XHR();request.open('POST','/jwglxt/kbcx/query');request.send();request.responseText=JSON.stringify(response);request.loaded();assert.equal(window.__courseCompassCollector.read().kbList[0].kcmc,'测试');
 await window.fetch('/jwglxt/kbcx/query');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(window.__courseCompassCollector.read().kbList.length,1);
});
test('同步复用同源课表查询，拒绝跨站和非课表接口，过期会话不会报成功',async()=>{
 class XHR{open(){}send(){}addEventListener(name,fn){this.loaded=fn;}}
 let expired=false,last;const value={kbList:[{kcmc:'新课表'}]};const window={location:{href:'https://jw.gzist.edu.cn/jwglxt/kbcx/index',origin:'https://jw.gzist.edu.cn'},fetch:async(url,options)=>{last={url,options};return {ok:true,json:async()=>{if(expired)throw Error('HTML login');return value;},clone:()=>({json:async()=>value})};}};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams});vm.runInContext(source,context);const c=window.__courseCompassCollector;const xhr=new XHR();xhr.open('POST','/jwglxt/kbcx/query');xhr.send('xnm=2026&xqm=3');xhr.responseText=JSON.stringify(value);xhr.loaded();assert.equal(c.recipe.body,'xnm=2026&xqm=3');await c.replay(c.recipe);assert.equal(c.syncStatus,'ready');assert.equal(last.options.credentials,'same-origin');assert.equal(last.options.body,'xnm=2026&xqm=3');
 await assert.rejects(c.replay({method:'POST',url:'https://example.com/jwglxt/kbcx/query'}),/同步地址无效/);await assert.rejects(c.replay({method:'POST',url:'https://jw.gzist.edu.cn/login'}),/同步地址无效/);expired=true;await assert.rejects(c.replay(c.recipe),/会话已失效/);assert.equal(c.syncStatus,'login');assert.equal(c.data,null);
});


test('提前采集将学校帧的首个响应立即回传，只包含排课字段；fetch 保存同步请求',async()=>{
 class XHR{open(){}send(){}addEventListener(name,fn){this.loaded=fn;}}
 const messages=[];const row={kcmc:'帧内课程',xqj:4,jcs:'3-4',zcd:'1-16',cdmc:'A101',studentSecret:'never-send'};
 const value={result:{rows:[row]}};
 const window={location:{href:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile',origin:'http://jw.gzist.edu.cn'},CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))},fetch:async()=>({ok:true,clone:()=>({json:async()=>value}),json:async()=>value})};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams});vm.runInContext(source,context);
 assert.equal(messages[0].type,'ready');
 // This is the school's initial XHR, before read() is called.
 const xhr=new XHR();xhr.open('POST','/jwglxt/kbcx/query');xhr.send('xnm=2026&xqm=3');xhr.responseText=JSON.stringify(value);xhr.loaded();
 assert.equal(messages[1].type,'timetable');assert.equal(messages[1].data.kbList[0].kcmc,'帧内课程');assert.equal(messages[1].data.kbList[0].studentSecret,undefined);
 assert.equal(messages[1].query.body,'xnm=2026&xqm=3');
 await window.fetch('/jwglxt/kbcx/query',{method:'POST',body:'xnm=2026&xqm=12'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(window.__courseCompassCollector.recipe.body,'xnm=2026&xqm=12');
 await window.__courseCompassCollector.replay(window.__courseCompassCollector.recipe);assert.equal(window.__courseCompassCollector.syncStatus,'ready');
});

test('已存在的全局课表可以读取，报告无数据不会伪造课程',()=>{
 class XHR{open(){}send(){}addEventListener(){}}
 const messages=[];const window={CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))}};
 const context=vm.createContext({window,XMLHttpRequest:XHR});vm.runInContext(source,context);
 assert.equal(window.__courseCompassCollector.report(),null);assert.equal(messages.at(-1).type,'status');
 window.kbList=[{kcmc:'已加载的课程',xqj:1,jcs:'1-2',zcd:'1-16'}];
 assert.equal(window.__courseCompassCollector.report().kbList.length,1);assert.equal(messages.at(-1).type,'timetable');
});


test('从页面当前学年学期主动请求完整课表，复用会话，不猜测缺失学期',async()=>{
 class XHR{open(){}send(){}addEventListener(){}}
 let sent;const messages=[];
 const window={location:{href:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile?gnmkdm=Y253511',origin:'http://jw.gzist.edu.cn'},document:{querySelector:selector=>({value:selector.includes('xnm')?'2026':'3'})},CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))},fetch:async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({kbList:[{kcmc:'完整学期',xqj:2,jc:'3-4节',zcd:'1-16'}]})};}};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams});vm.runInContext(source,context);await window.__courseCompassCollector.obtain();
 assert.equal(sent.url,'http://jw.gzist.edu.cn/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=Y253511');assert.match(sent.options.body,/xnm=2026&xqm=3/);assert.equal(sent.options.credentials,'same-origin');assert.equal(window.__courseCompassCollector.data.kbList[0].jc,'3-4节');
 const other={location:window.location,CourseCompassCapture:window.CourseCompassCapture,fetch:async()=>{throw Error('must not guess');}};
 const second=vm.createContext({window:other,XMLHttpRequest:class {open(){}send(){}addEventListener(){}},URL,URLSearchParams});vm.runInContext(source,second);assert.equal(await other.__courseCompassCollector.obtain(),null);assert.match(messages.findLast(packet=>packet.reason)?.reason,/未找到/);
});


test('正方接口 jc 节次与 jcs 兼容，无法识别的节次拒绝导入',async()=>{
 const {importData}=await import('../dist/adapters/registry.js');await import('../dist/adapters/zfsoft.js');
 const course={kcmc:'兼容性测试',xqj:2,jc:'3-4节',zcd:'1-16'};
 const result=importData({kbList:[course]});assert.equal(result.courses[0].start,3);assert.equal(result.courses[0].end,4);
 assert.throws(()=>importData({kbList:[{...course,jc:'未知'}]}),/无法识别/);
});


test('周查询范围随数据回传，主动读取不会被已缓存的周课表短路',async()=>{
 class XHR{open(){}send(){}addEventListener(name,fn){this.loaded=fn;}}
 const messages=[];let calls=0;const window={location:{href:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile',origin:'http://jw.gzist.edu.cn'},CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))},fetch:async()=>{calls++;return {ok:true,json:async()=>({kbList:[{kcmc:'整学期测试',xqj:1,jcs:'1-2',zcd:'1-16周'}]})};}};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams});vm.runInContext(source,context);const xhr=new XHR();xhr.open('POST','/jwglxt/kbcx/mobile');xhr.send('xnm=2026&xqm=3&zc=6');xhr.responseText=JSON.stringify({kbList:[{kcmc:'单周测试',xqj:1,jcs:'1-2',zcd:'第6周'}]});xhr.loaded();
 assert.equal(messages.at(-1).data.sourceScope.type,'week');assert.equal(messages.at(-1).data.sourceScope.weeks[0],6);
 await window.__courseCompassCollector.obtain();assert.equal(calls,1);assert.equal(messages.at(-1).data.sourceScope.type,'term');assert.equal(messages.at(-1).readResult,true);
});

test('整学期接口失败时返回已捕获的周课表，不丢失查询范围',async()=>{
 class XHR{open(){}send(){}addEventListener(){}}
 const messages=[];const window={location:{href:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile',origin:'http://jw.gzist.edu.cn'},CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))},fetch:async()=>({ok:false})};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams});vm.runInContext(source,context);const c=window.__courseCompassCollector;
 c.accept({kbList:[{kcmc:'单周测试',xqj:1,jcs:'1-2',zcd:'第6周'}]},{method:'POST',url:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile',body:'xnm=2026&xqm=3&zc=6'});
 await c.obtain();assert.equal(messages.at(-1).readResult,true);assert.equal(messages.at(-1).data.sourceScope.weeks[0],6);assert.equal(c.data.kbList.length,1);
});

test('强制刷新即使已有完整课表也重新查询；失败不把旧数据当同步成功',async()=>{
 class XHR{open(){}send(){}addEventListener(){}}let calls=0,fail=false;const messages=[];const window={location:{href:'http://jw.gzist.edu.cn/jwglxt/kbcx/mobile',origin:'http://jw.gzist.edu.cn'},CourseCompassCapture:{postMessage:text=>messages.push(JSON.parse(text))},fetch:async()=>{calls++;return {ok:!fail,json:async()=>({kbList:[{kcmc:'新课表',xqj:1,jcs:'1-2',zcd:'1-16'}]})};}};
 vm.runInContext(source,vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams}));const c=window.__courseCompassCollector;c.accept({kbList:[{kcmc:'旧课表',xqj:1,jcs:'1-2',zcd:'1-16'}]},{method:'POST',url:'http://jw.gzist.edu.cn/jwglxt/kbcx/xskbcx_cxXsKb.html',body:'xnm=2026&xqm=3'});
 await c.obtain(true);assert.equal(calls,1);assert.equal(c.data.kbList[0].kcmc,'新课表');messages.length=0;fail=true;await c.obtain(true);assert.equal(calls,2);assert.equal(c.data.kbList[0].kcmc,'新课表');assert.equal(messages.some(m=>m.type==='timetable'&&m.readResult),false);assert.match(messages.at(-1).reason,/刷新失败/);
});

test('配置后的其他正方学校仅捕获该学校同源课表，拒绝原学校和第三方请求',async()=>{
 class XHR{open(){}send(){}addEventListener(n,fn){this.loaded=fn;}}
 const value={kbList:[{kcmc:'外校模拟课程'}]},host='jw.example.edu.cn';const window={__courseCompassSchoolHost:host,location:{href:'https://'+host+'/jwglxt/kbcx/index',origin:'https://'+host},fetch:async()=>({ok:true,json:async()=>value,clone:()=>({json:async()=>value})})};
 vm.runInContext(source,vm.createContext({window,XMLHttpRequest:XHR,URL,URLSearchParams}));const xhr=new XHR();xhr.open('POST','/jwglxt/kbcx/query');xhr.send('xnm=2026&xqm=3');xhr.responseText=JSON.stringify(value);xhr.loaded();const c=window.__courseCompassCollector;assert.equal(c.recipe.url,'https://'+host+'/jwglxt/kbcx/query');await c.replay(c.recipe);assert.equal(c.syncStatus,'ready');await assert.rejects(c.replay({method:'POST',url:'https://jw.gzist.edu.cn/jwglxt/kbcx/query'}));await assert.rejects(c.replay({method:'POST',url:'https://evil.test/jwglxt/kbcx/query'}));
});
