export const PREFS_KEY='course-compass.demo.prefs';
export const DEFAULT_APPEARANCE={wallpaper:'sky',blur:0,shade:12,opacity:58,position:50,dark:false,accent:'#368bc1',source:'sample',weekend:false,font:'system',haptics:true,fontSize:10,rowHeight:68,gridGap:4,autoContrast:true,capsuleExpanded:false,appearanceRevision:1,courseColors:{}};
// Course color keys identify the user's subjects and belong only in a full backup.
export const THEME_KEYS=['wallpaper','blur','shade','opacity','position','dark','accent','font','fontSize','rowHeight','gridGap','autoContrast'];
export const DENSITY_PRESETS={compact:{fontSize:9,rowHeight:64,gridGap:3},comfortable:{fontSize:10,rowHeight:84,gridGap:5}};
export function validateAppearance(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('外观设置格式无效');
 const result={...DEFAULT_APPEARANCE,courseColors:{}};
 for(const k of ['dark','weekend','haptics','autoContrast','capsuleExpanded'])if(typeof raw[k]==='boolean')result[k]=raw[k];
 for(const [k,a,b] of [['blur',0,18],['shade',0,70],['opacity',20,100],['position',0,100],['fontSize',9,14],['rowHeight',64,124],['gridGap',2,8]])if(raw[k]!==null&&raw[k]!==''&&Number.isFinite(Number(raw[k])))result[k]=Math.min(b,Math.max(a,Number(raw[k])));
 if(['sky','mint','dusk','night','custom'].includes(raw.wallpaper))result.wallpaper=raw.wallpaper;
 if(/^#[0-9a-f]{6}$/i.test(raw.accent))result.accent=raw.accent;
 if(['sample','existing'].includes(raw.source))result.source=raw.source;
 if(['system','rounded','mono'].includes(raw.font))result.font=raw.font;
 if(raw.courseColors&&typeof raw.courseColors==='object'&&!Array.isArray(raw.courseColors))for(const [key,color] of Object.entries(raw.courseColors).slice(0,300))if(/^cc-[0-9a-f]{8}$/.test(key)&&/^#[0-9a-f]{6}$/i.test(color))result.courseColors[key]=color.toLowerCase();
 return result;
}
export function courseColorKey(course){
 const name=String(course?.name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 let hash=2166136261;for(let i=0;i<name.length;i++){hash^=name.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return 'cc-'+(hash>>>0).toString(16).padStart(8,'0');
}
export function layoutMetrics(raw={}){
 const prefs=validateAppearance(raw),fontSize=prefs.fontSize,rowHeight=Math.max(prefs.rowHeight,Math.ceil(fontSize*4.2+26));
 return {fontSize,rowHeight,gridGap:prefs.gridGap,titleLines:rowHeight>=fontSize*6.4+20?3:2};
}
export function relativeLuminance(r,g,b){
 const channels=[r,g,b].map(value=>{const s=Math.max(0,Math.min(255,Number(value)||0))/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
export function analyseWallpaper(pixels){
 let weight=0,total=0,square=0;const values=[];
 for(let i=0;i+3<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.1)continue;const l=relativeLuminance(pixels[i],pixels[i+1],pixels[i+2]);total+=l*alpha;square+=l*l*alpha;weight+=alpha;values.push(l);}
 if(!weight)return {luminance:.7,variation:0,dark:false,busy:false};
 const luminance=total/weight,variation=Math.sqrt(Math.max(0,square/weight-luminance*luminance));values.sort((a,b)=>a-b);
 const dark=values[Math.floor(values.length/2)]<.3;
 return {luminance,variation,dark,busy:variation>.19};
}
export function readabilityStyle(raw={},sample={luminance:.7,variation:0,dark:false,busy:false}){
 const prefs=validateAppearance(raw),auto=prefs.autoContrast,lum=Number.isFinite(sample.luminance)?sample.luminance:.7;
 return {enabled:auto,dark:auto&&Boolean(sample.dark),cardAlpha:prefs.opacity/100,textAlpha:auto?(sample.busy?.86:.76):0,localBlur:auto?(sample.busy?9:5):0,labelAlpha:auto?(sample.busy ? .78 : .62):0,luminance:lum};
}
// Change only the former defaults once. User-selected density and transparency
// remain intact; the raw course envelope and its time labels are never touched.
export function migrateAppearance060(storage=globalThis.localStorage){
 const text=storage?.getItem(PREFS_KEY);if(!text)return false;const raw=JSON.parse(text);if(raw.appearanceRevision===1)return false;
 const next={...raw,appearanceRevision:1};if(raw.rowHeight===84&&(raw.fontSize??10)===10&&(raw.gridGap??4)===4)next.rowHeight=68;if(raw.opacity===84)next.opacity=58;
 storage.setItem(PREFS_KEY,JSON.stringify(next));return true;
}
export function validateWidget(raw={}){
 return {style:['glass','pixel','record'].includes(raw.style)?raw.style:'glass',content:['course','date','quote'].includes(raw.content)?raw.content:'course',quote:String(raw.quote||'留一点时间，给喜欢的事').slice(0,60),showInApp:raw.showInApp===true,accent:/^#[0-9a-f]{6}$/i.test(raw.accent)?raw.accent:'#368bc1',opacity:Math.max(40,Math.min(100,Number(raw.opacity)||90))};
}
