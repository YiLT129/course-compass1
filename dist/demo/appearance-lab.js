import {analyseWallpaper,courseColorKey,DENSITY_PRESETS,layoutMetrics,readabilityStyle,validateAppearance} from '../core/appearance.js';
import {PERSONAL_KEY,validatePersonal} from '../core/personalization.js';

const BUILTIN_SAMPLES={sky:[216,234,235],mint:[217,235,216],dusk:[242,225,217],night:[36,65,80]};
const RGB=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
const blend=(a,b,weight)=>a.map((n,i)=>Math.round(n*weight+b[i]*(1-weight)));
const STICKER_PALETTE=['✨','🐱','🎧','🌙','🌻','🎮','🪐','☕'];
export function addPreviewSticker(raw,text,id){
 const state=validatePersonal(raw);return validatePersonal({...state,items:[...state.items,{id,type:'sticker',text,x:68,y:24,scale:1,rotation:0,z:Math.min(99,Math.max(0,...state.items.map(item=>item.z))+1)}]});
}
export function editPreviewSticker(raw,id,patch){
 const state=validatePersonal(raw);if(!state.items.some(item=>item.id===id&&item.type==='sticker'))throw Error('请先选择一个贴纸');
 const allowed={};for(const key of ['scale','rotation'])if(Object.hasOwn(patch,key))allowed[key]=patch[key];
 return validatePersonal({...state,items:state.items.map(item=>item.id===id&&item.type==='sticker'?{...item,...allowed}:item)});
}
export function removePreviewSticker(raw,id){
 const state=validatePersonal(raw);return validatePersonal({...state,items:state.items.filter(item=>item.id!==id||item.type!=='sticker')});
}

/** Mounts into the registered appearance sheet; callbacks own persistence and navigation. */
export function setupAppearanceLab({getPrefs,updatePrefs,getCourses=()=>[],getPreviewBlocks=getCourses,openSheet,notify=()=>{},onPersonalChange=()=>{}}){
 const sheet=document.querySelector('#appearance-sheet'),wallpaper=document.querySelector('#wallpaper');
 if(!sheet)return {refresh(){},onWallpaperChange(){}};
 let sample=analyseWallpaper(new Uint8ClampedArray([...BUILTIN_SAMPLES.sky,255])),lastImage='',generation=0,frame=0,lastCourses='',selectedSticker='';
 const preview=sheet.querySelector('.appearance-preview')||document.createElement('div');
 preview.className='appearance-preview appearance-live-preview';
 preview.innerHTML='<div class="lab-preview-heading"><strong>实时预览</strong><span>七天同屏 · 连堂分组</span><button type="button" data-close="appearance-sheet" aria-label="关闭外观设置">✕</button></div><div class="lab-preview-days" aria-hidden="true">'+['一','二','三','四','五','六','日'].map(day=>'<span>'+day+'</span>').join('')+'</div><div class="lab-preview-grid" aria-label="当前外观的课程预览"></div><p class="lab-sample-state" role="status"></p>';
 if(!preview.parentNode)sheet.querySelector('.sheet-title').after(preview);
 const density=document.createElement('section');density.className='appearance-lab';density.setAttribute('aria-label','课表密度');
 density.innerHTML='<div class="lab-section-heading"><h3>看起来刚刚好</h3><span id="lab-density-summary"></span></div><div class="lab-presets" role="group" aria-label="课表密度预设"><button type="button" data-density="compact">紧凑</button><button type="button" data-density="comfortable">舒展</button></div><div class="slider-row"><label for="lab-font-size">课名字号</label><output id="lab-font-size-value"></output><input id="lab-font-size" type="range" min="9" max="14" step="1"></div><div class="slider-row"><label for="lab-row-height">每节高度</label><output id="lab-row-height-value"></output><input id="lab-row-height" type="range" min="64" max="124" step="2"></div><div class="slider-row"><label for="lab-grid-gap">课块间距</label><output id="lab-grid-gap-value"></output><input id="lab-grid-gap" type="range" min="2" max="8" step="1"></div><label class="lab-auto-contrast"><span><b>让文字自动看清</b><small>按壁纸明暗调整时间文字、卡片和局部模糊</small></span><input id="lab-auto-contrast" type="checkbox" role="switch"></label>';
 preview.after(density);
 const densityTip=document.createElement('p');densityTip.className='sheet-tip lab-density-tip';densityTip.textContent='大字号会自动留出必要高度，避免文字被裁切。';density.querySelector('.lab-auto-contrast').before(densityTip);
 const stickerTools=document.createElement('section');stickerTools.className='appearance-lab lab-sticker-tools';
 stickerTools.innerHTML='<div class="lab-section-heading"><h3>贴纸也一起预览</h3><span>点选 · 调大小 · 转角度</span></div><div class="lab-sticker-palette" role="group" aria-label="添加预览贴纸">'+STICKER_PALETTE.map(text=>'<button type="button" data-lab-sticker="'+text+'" aria-label="添加'+text+'贴纸">'+text+'</button>').join('')+'</div><label class="control-label">选择贴纸<select id="lab-sticker-select"></select></label><div class="slider-row"><label for="lab-sticker-scale">大小</label><output id="lab-sticker-scale-value"></output><input id="lab-sticker-scale" type="range" min=".5" max="2" step=".05"></div><div class="slider-row"><label for="lab-sticker-rotation">旋转</label><output id="lab-sticker-rotation-value"></output><input id="lab-sticker-rotation" type="range" min="-45" max="45" step="1"></div><div class="lab-sticker-actions"><button type="button" id="lab-sticker-remove">删除选中贴纸</button><button type="button" data-action="decorations" id="lab-sticker-placement">进入完整摆放 ↗</button></div><p class="sheet-tip" id="lab-sticker-description">预览与课表使用同一份贴纸，修改自动保存。移动位置、图层和撤销可进入完整摆放。</p>';
 density.after(stickerTools);
 const colors=document.createElement('section');colors.className='appearance-lab lab-course-colors';
 colors.innerHTML='<div class="lab-section-heading"><h3>每门课有自己的颜色</h3></div><label class="control-label">选择课程<select id="lab-course-select"></select></label><div class="lab-color-row"><label for="lab-course-color">课程颜色<input id="lab-course-color" type="color" value="#368bc1"></label><button id="lab-course-color-reset" type="button">恢复默认色</button></div><p class="sheet-tip">同名课程统一换色；同步课表后保留。课程配色仅进入完整备份，不包含在分享主题中。</p><div class="lab-shortcuts"><button type="button" data-action="decorations" id="lab-stickers">贴纸与摆放 ↗</button><button type="button" data-action="themes" id="lab-themes">主题包与换装 ↗</button></div>';
 sheet.append(colors);
 const $=selector=>sheet.querySelector(selector),grid=preview.querySelector('.lab-preview-grid');

 function patch(value){updatePrefs(value);refresh();}
 const fields={'lab-font-size':'fontSize','lab-row-height':'rowHeight','lab-grid-gap':'gridGap'};
 for(const [id,key] of Object.entries(fields))$('#'+id).addEventListener('input',event=>patch({[key]:Number(event.target.value)}));
 $('#lab-auto-contrast').addEventListener('change',event=>patch({autoContrast:event.target.checked}));
 for(const button of density.querySelectorAll('[data-density]'))button.addEventListener('click',()=>patch({...DENSITY_PRESETS[button.dataset.density]}));
 $('#lab-course-select').addEventListener('change',updateColorInput);
 $('#lab-course-color').addEventListener('input',event=>{const key=$('#lab-course-select').value;if(key)patch({courseColors:{...validateAppearance(getPrefs()).courseColors,[key]:event.target.value}});});
 $('#lab-course-color-reset').addEventListener('click',()=>{const key=$('#lab-course-select').value;if(!key)return;const courseColors={...validateAppearance(getPrefs()).courseColors};delete courseColors[key];patch({courseColors});notify('已恢复这门课的默认配色');});
 function personalState(){return validatePersonal(JSON.parse(localStorage.getItem(PERSONAL_KEY)||'{}'));}
 function saveSticker(next){try{localStorage.setItem(PERSONAL_KEY,JSON.stringify(next));}catch(error){notify('贴纸未保存：'+error.message);return false;}onPersonalChange();refresh();return true;}
 stickerTools.querySelector('.lab-sticker-palette').addEventListener('click',event=>{const text=event.target.closest('[data-lab-sticker]')?.dataset.labSticker;if(!text)return;try{const id=crypto.randomUUID(),next=addPreviewSticker(personalState(),text,id);selectedSticker=id;if(saveSticker(next))notify('贴纸已加入，可直接调整大小和角度');}catch(error){notify(error.message);}});
 $('#lab-sticker-select').addEventListener('change',event=>{selectedSticker=event.target.value;refresh();});
 for(const name of ['scale','rotation'])$('#lab-sticker-'+name).addEventListener('input',event=>{try{saveSticker(editPreviewSticker(personalState(),selectedSticker,{[name]:Number(event.target.value)}));}catch(error){notify(error.message);}});
 $('#lab-sticker-remove').addEventListener('click',()=>{if(!selectedSticker)return;try{if(saveSticker(removePreviewSticker(personalState(),selectedSticker)))notify('已删除选中贴纸');}catch(error){notify(error.message);}});
 // Existing delegated handlers populate each destination before opening it.
 for(const id of ['#lab-stickers','#lab-themes','#lab-sticker-placement'])$(id).onclick=()=>sheet.close();

 function subjects(){const seen=new Set();return getCourses().filter(course=>{const key=courseColorKey(course);if(seen.has(key))return false;seen.add(key);return true;});}
 function updateColorInput(){const prefs=validateAppearance(getPrefs()),key=$('#lab-course-select').value,color=prefs.courseColors[key];$('#lab-course-color').value=color||prefs.accent;$('#lab-course-color').disabled=!key;$('#lab-course-color-reset').disabled=!color;}
 function renderSubjects(){
  const courses=subjects(),signature=JSON.stringify(courses.map(c=>[courseColorKey(c),c.name]));
  if(signature!==lastCourses){lastCourses=signature;const selected=$('#lab-course-select').value;$('#lab-course-select').replaceChildren();for(const c of courses){const option=document.createElement('option');option.value=courseColorKey(c);option.textContent=c.name;$('#lab-course-select').append(option);}if(!courses.length){const option=document.createElement('option');option.value='';option.textContent='导入课程后可设置';$('#lab-course-select').append(option);}else if(courses.some(c=>courseColorKey(c)===selected))$('#lab-course-select').value=selected;}
  updateColorInput();
 }
 function applyCourseColors(prefs){
  const byId=new Map(getCourses().map(c=>[String(c.id),c]));
  for(const node of document.querySelectorAll('.course-card[data-course],.agenda-card[data-course],.list-card[data-course],.lab-preview-course')){
   const course=node.classList.contains('lab-preview-course')?{name:node.dataset.courseName}:byId.get(node.dataset.course),color=course&&prefs.courseColors[courseColorKey(course)];
   if(color){const rgb=RGB(color),base=prefs.dark?[25,43,58]:[255,255,255],tint=blend(rgb,base,prefs.dark ? .28 : .16),ink=prefs.dark?'#e0edf7':'#243849';node.dataset.customColor='true';node.style.setProperty('--course-custom-rgb',tint.join(','));node.style.setProperty('--course-custom-ink',ink);node.style.setProperty('--course-custom-color',color);}
   else{delete node.dataset.customColor;for(const key of ['--course-custom-rgb','--course-custom-ink','--course-custom-color'])node.style.removeProperty(key);}
  }
 }
 function renderPreview(prefs){
  const image=wallpaper?getComputedStyle(wallpaper).backgroundImage:'none';preview.style.backgroundImage=image;
  preview.style.backgroundPosition='50% '+prefs.position+'%';grid.replaceChildren();
  const courses=getPreviewBlocks(),seenSlots=new Map();
  for(const c of courses){const day=Math.max(1,Math.min(7,Number(c.day)||1)),row=(seenSlots.get(day)||0)+1;if(row>2)continue;seenSlots.set(day,row);const card=document.createElement('div');card.className='lab-preview-course tone-'+(['blue','green','purple','orange','rose','slate'].includes(c.tone)?c.tone:'blue');card.dataset.courseName=c.name;card.style.gridColumn=day;card.style.gridRow=row;card.title=c.name;const title=document.createElement('strong');title.textContent=c.name;const sub=document.createElement('span');sub.textContent='第'+(c.start===c.end?c.start:c.start+'–'+c.end)+'节';card.append(title,sub);grid.append(card);}
  if(!courses.length){const empty=document.createElement('span');empty.className='lab-preview-empty';empty.textContent='导入课表后，在这里实时预览';grid.append(empty);}
 }
 function renderStickers(){
  let state;try{state=personalState();}catch{for(const input of stickerTools.querySelectorAll('input,select,button'))input.disabled=true;$('#lab-sticker-description').textContent='挂件数据暂时无法读取，请先导出完整备份再检查；本次没有修改原数据。';return;}
  const stickers=state.items.filter(item=>item.type==='sticker');if(!stickers.some(item=>item.id===selectedSticker))selectedSticker=stickers[0]?.id||'';
  const select=$('#lab-sticker-select');select.replaceChildren();for(const item of stickers){const option=document.createElement('option');option.value=item.id;option.textContent=item.text+(item.locked?' · 位置已锁定':'');select.append(option);}if(!stickers.length){const option=document.createElement('option');option.value='';option.textContent='点上方表情添加贴纸';select.append(option);}select.value=selectedSticker;
  const active=stickers.find(item=>item.id===selectedSticker);select.disabled=!stickers.length;for(const name of ['scale','rotation']){const input=$('#lab-sticker-'+name);input.disabled=!active;if(document.activeElement!==input)input.value=active?.[name]??(name==='scale'?1:0);$('#lab-sticker-'+name+'-value').value=active?(name==='scale'?Math.round(active.scale*100)+'%':active.rotation+'°'):'—';}$('#lab-sticker-remove').disabled=!active;
  $('#lab-sticker-description').textContent=state.visible?'预览与课表使用同一份贴纸，修改自动保存。移动位置、图层和撤销可进入完整摆放。':'你已隐藏全部挂件。这里仍可编辑贴纸；进入完整摆放后可开启显示。';
  const layer=document.createElement('div');layer.className='lab-preview-stickers';layer.setAttribute('aria-label','贴纸实时预览');layer.classList.toggle('is-hidden-on-schedule',!state.visible);for(const item of stickers){const button=document.createElement('button');button.type='button';button.className='lab-preview-sticker'+(item.id===selectedSticker?' selected':'');button.textContent=item.text;button.setAttribute('aria-label','选择贴纸 '+item.text);button.setAttribute('aria-pressed',String(item.id===selectedSticker));button.style.cssText='left:'+item.x+'%;top:'+item.y+'%;transform:translate(-'+item.x+'%,-'+item.y+'%) rotate('+item.rotation+'deg) scale('+item.scale+');z-index:'+item.z;button.onclick=()=>{selectedSticker=item.id;refresh();};layer.append(button);}grid.append(layer);
 }
 function updateReadability(prefs){
  const style=readabilityStyle(prefs,sample),root=document.documentElement;
  document.body.dataset.autoContrast=style.enabled?'on':'off';document.body.dataset.wallpaperTone=style.dark?'dark':'light';
  root.style.setProperty('--card-alpha',String(style.cardAlpha));root.style.setProperty('--readability-blur',style.localBlur+'px');root.style.setProperty('--readability-label-alpha',String(style.labelAlpha));
  preview.querySelector('.lab-sample-state').textContent=!style.enabled?'使用你的手动透明度设置':sample.busy?'多色壁纸 · 已加强文字底衬与卡片清晰度':style.dark?'深色壁纸 · 时间文字自动提亮':'浅色壁纸 · 时间文字自动加深';
 }
 async function sampleImage(source){
  const thisGeneration=++generation;
  if(!source.startsWith('url(')){const rgb=BUILTIN_SAMPLES[validateAppearance(getPrefs()).wallpaper]||BUILTIN_SAMPLES.sky;sample=analyseWallpaper(new Uint8ClampedArray([...rgb,255]));updateReadability(validateAppearance(getPrefs()));return;}
  try{
   const match=/^url\(["']?(.*?)["']?\)$/.exec(source);if(!match)return;
   const image=new Image();image.decoding='async';image.src=match[1];await image.decode();
   if(thisGeneration!==generation)return;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
   ctx.drawImage(image,0,0,32,32);sample=analyseWallpaper(ctx.getImageData(0,0,32,32).data);updateReadability(validateAppearance(getPrefs()));
  }catch{if(thisGeneration!==generation)return;sample=analyseWallpaper(new Uint8ClampedArray([190,205,215,255]));updateReadability(validateAppearance(getPrefs()));}
 }
 function refresh(){
  const prefs=validateAppearance(getPrefs()),metrics=layoutMetrics(prefs),root=document.documentElement;
  root.style.setProperty('--tt-font-size',metrics.fontSize+'px');root.style.setProperty('--tt-row-height',metrics.rowHeight+'px');root.style.setProperty('--tt-gap',metrics.gridGap+'px');root.style.setProperty('--tt-card-inset',Math.max(1,metrics.gridGap/2)+'px');root.style.setProperty('--tt-title-lines',String(metrics.titleLines));
  for(const [id,key] of Object.entries(fields)){if(document.activeElement!==$('#'+id))$('#'+id).value=prefs[key];$('#'+id+'-value').value=prefs[key]+' px';}
  $('#lab-auto-contrast').checked=prefs.autoContrast;$('#lab-density-summary').textContent=metrics.rowHeight+' px / 节';
  for(const button of density.querySelectorAll('[data-density]'))button.setAttribute('aria-pressed',String(Object.entries(DENSITY_PRESETS[button.dataset.density]).every(([key,value])=>prefs[key]===value)));
  renderSubjects();renderPreview(prefs);renderStickers();applyCourseColors(prefs);updateReadability(prefs);
  const source=wallpaper?getComputedStyle(wallpaper).backgroundImage:'none',signature=prefs.wallpaper+'|'+source;if(signature!==lastImage){lastImage=signature;void sampleImage(source);}
 }
 function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;refresh();});}
 const observer=new MutationObserver(schedule);for(const id of ['timetable','today-list','course-list']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true});}
 const wallpaperObserver=new MutationObserver(schedule);if(wallpaper)wallpaperObserver.observe(wallpaper,{attributes:true,attributeFilter:['class','style']});
 sheet.addEventListener('input',event=>{if(!event.target.id.startsWith('lab-'))schedule();});sheet.addEventListener('change',schedule);
 // Existing wallpaper, accent and dark-mode buttons persist through their original handlers.
 sheet.addEventListener('click',event=>{if(event.target.closest('[data-wallpaper],[data-accent],[data-action="dark"]'))schedule();});
 new MutationObserver(()=>{if(sheet.open)schedule();}).observe(sheet,{attributes:true,attributeFilter:['open']});
 refresh();
 return {refresh,onWallpaperChange(){lastImage='';schedule();},destroy(){observer.disconnect();wallpaperObserver.disconnect();cancelAnimationFrame(frame);}};
}
