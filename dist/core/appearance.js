export const PREFS_KEY='course-compass.demo.prefs';
export const DEFAULT_APPEARANCE={wallpaper:'sky',blur:0,shade:12,opacity:84,position:50,dark:false,accent:'#368bc1',source:'sample',weekend:false,font:'system',haptics:true};
export const THEME_KEYS=['wallpaper','blur','shade','opacity','position','dark','accent','font'];
export function validateAppearance(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('外观设置格式无效');
 const result={...DEFAULT_APPEARANCE};
 for(const k of ['dark','weekend','haptics'])if(typeof raw[k]==='boolean')result[k]=raw[k];
 for(const [k,a,b] of [['blur',0,18],['shade',0,70],['opacity',55,100],['position',0,100]])if(Number.isFinite(Number(raw[k])))result[k]=Math.min(b,Math.max(a,Number(raw[k])));
 if(['sky','mint','dusk','night','custom'].includes(raw.wallpaper))result.wallpaper=raw.wallpaper;
 if(/^#[0-9a-f]{6}$/i.test(raw.accent))result.accent=raw.accent;
 if(['sample','existing'].includes(raw.source))result.source=raw.source;
 if(['system','rounded','mono'].includes(raw.font))result.font=raw.font;
 return result;
}
export function validateWidget(raw={}){
 return {style:['glass','pixel','record'].includes(raw.style)?raw.style:'glass',content:['course','date','quote'].includes(raw.content)?raw.content:'course',quote:String(raw.quote||'留一点时间，给喜欢的事').slice(0,60),showInApp:raw.showInApp===true,accent:/^#[0-9a-f]{6}$/i.test(raw.accent)?raw.accent:'#368bc1',opacity:Math.max(40,Math.min(100,Number(raw.opacity)||90))};
}
