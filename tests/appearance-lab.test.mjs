import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_APPEARANCE,THEME_KEYS,DENSITY_PRESETS,validateAppearance,layoutMetrics,courseColorKey,relativeLuminance,analyseWallpaper,readabilityStyle} from '../dist/core/appearance.js';
import {validatePackage,themeFromBackup,mergeTheme} from '../dist/core/packages.js';
import {addPreviewSticker,editPreviewSticker,removePreviewSticker} from '../dist/demo/appearance-lab.js';

test('旧版外观迁移获得合适的密度，周末及手动配置仍保留',()=>{
 const prefs=validateAppearance({weekend:true,wallpaper:'night',font:'rounded',opacity:75});
 assert.equal(prefs.fontSize,10);assert.equal(prefs.rowHeight,84);assert.equal(prefs.gridGap,4);assert.equal(prefs.autoContrast,true);assert.equal(prefs.capsuleExpanded,false);
 assert.equal(prefs.weekend,true);assert.equal(prefs.wallpaper,'night');assert.equal(prefs.opacity,75);
 const first=validateAppearance({});first.courseColors['cc-12345678']='#ffffff';assert.deepEqual(validateAppearance({}).courseColors,{});assert.deepEqual(DEFAULT_APPEARANCE.courseColors,{});
});
test('密度边界拦截恶意值，大字号不会挤进过矮的课块',()=>{
 const prefs=validateAppearance({fontSize:100,rowHeight:-100,gridGap:Infinity});
 assert.equal(prefs.fontSize,14);assert.equal(prefs.rowHeight,64);assert.equal(prefs.gridGap,4);
 assert.deepEqual([validateAppearance({fontSize:null,rowHeight:''}).fontSize,validateAppearance({fontSize:null,rowHeight:''}).rowHeight],[10,84]);
 const big=layoutMetrics(prefs);assert.ok(big.rowHeight>=85);assert.equal(big.titleLines,2);
 assert.ok(layoutMetrics(DENSITY_PRESETS.compact).rowHeight<layoutMetrics(DENSITY_PRESETS.comfortable).rowHeight);
 assert.equal(layoutMetrics({rowHeight:124,fontSize:14}).titleLines,3);
});
test('同名课程颜色跨排课记录与同步ID变化保留，危险及无效键被过滤',()=>{
 const key=courseColorKey({id:'old',name:'  Ｃ语言  程序设计 '});assert.equal(key,courseColorKey({id:'new',name:'c语言 程序设计'}));assert.notEqual(key,courseColorKey({name:'电机学'}));
 const prefs=validateAppearance({courseColors:{[key]:'#AaBbcC','__proto__':'#ffffff','private-student-id':'#ff0000','cc-12345678':'url(secret)'}});
 assert.deepEqual(prefs.courseColors,{[key]:'#aabbcc'});
 assert.equal(Object.keys(validateAppearance({courseColors:Object.fromEntries(Array.from({length:400},(_,i)=>['cc-'+i.toString(16).padStart(8,'0'),'#ffffff']))}).courseColors).length,300);
});
test('完整备份保留课程配色与胶囊状态，分享主题排除二者并保留通用外观',()=>{
 const key=courseColorKey({name:'私密课程名'}),backup={format:'course-compass.backup',version:1,state:{'course-compass.demo.prefs':JSON.stringify({weekend:true,capsuleExpanded:true,fontSize:13,rowHeight:112,gridGap:7,courseColors:{[key]:'#aabbcc'}})},assets:{},themes:[]};
 const valid=validatePackage(backup),restored=JSON.parse(valid.state['course-compass.demo.prefs']);assert.equal(restored.courseColors[key],'#aabbcc');assert.equal(restored.capsuleExpanded,true);
 const theme=themeFromBackup(valid);assert.equal(THEME_KEYS.includes('courseColors'),false);assert.equal(THEME_KEYS.includes('capsuleExpanded'),false);assert.equal('courseColors' in theme.appearance,false);assert.equal('capsuleExpanded' in theme.appearance,false);assert.equal(theme.appearance.fontSize,13);assert.equal(theme.appearance.gridGap,7);
 assert.ok(!JSON.stringify(theme).includes(key));const merged=JSON.parse(mergeTheme(valid,theme).state['course-compass.demo.prefs']);assert.equal(merged.weekend,true);assert.equal(merged.capsuleExpanded,true);assert.equal(merged.courseColors[key],'#aabbcc');
});
test('壁纸分析使用线性亮度，识别深浅及高反差图片并忽略全透明像素',()=>{
 assert.equal(relativeLuminance(0,0,0),0);assert.equal(relativeLuminance(255,255,255),1);assert.ok(relativeLuminance(0,255,0)>relativeLuminance(255,0,0));
 const dark=analyseWallpaper(new Uint8ClampedArray([0,0,0,255,10,10,10,255]));assert.equal(dark.dark,true);assert.equal(dark.busy,false);
 const light=analyseWallpaper(new Uint8ClampedArray([255,255,255,255,0,0,0,0]));assert.equal(light.dark,false);assert.equal(light.luminance,1);
 const mixed=analyseWallpaper(new Uint8ClampedArray([0,0,0,255,255,255,255,255]));assert.equal(mixed.busy,true);assert.ok(mixed.variation>.4);
 assert.equal(analyseWallpaper(new Uint8ClampedArray([0,0,0,0])).dark,false);
});
test('自动清晰模式只提高必要的清晰度，关闭后服从手动透明度',()=>{
 const busy=readabilityStyle({opacity:55},{dark:true,busy:true,luminance:.2});assert.equal(busy.cardAlpha,.94);assert.equal(busy.dark,true);assert.equal(busy.localBlur,9);
 assert.equal(readabilityStyle({opacity:100},{busy:true}).cardAlpha,1);
 const manual=readabilityStyle({opacity:55,autoContrast:false},{dark:true,busy:true});assert.equal(manual.cardAlpha,.55);assert.equal(manual.localBlur,0);assert.equal(manual.labelAlpha,0);assert.equal(manual.dark,false);
});
test('统一预览只编辑贴纸，完整保留私人留言、链接、组件和显示偏好',()=>{
 const before={visible:false,widget:{content:'quote',quote:'私人组件句子'},items:[{id:'private-note',type:'note',text:'私人留言'},{id:'private-link',type:'link',text:'私人入口',url:'https://example.edu.cn/'},{id:'private-countdown',type:'countdown',text:'私人日期',date:'2027-01-01'}]};
 const added=addPreviewSticker(before,'🐱','sticker-qa');assert.equal(added.visible,false);assert.equal(added.widget.quote,'私人组件句子');assert.equal(added.items.length,4);
 const edited=editPreviewSticker(added,'sticker-qa',{scale:1.5,rotation:25,type:'link',text:'不允许篡改',url:'https://invalid.example/'});assert.equal(edited.items[3].type,'sticker');assert.equal(edited.items[3].text,'🐱');assert.equal(edited.items[3].scale,1.5);assert.equal(edited.items[3].rotation,25);assert.deepEqual(edited.items.slice(0,3),added.items.slice(0,3));
 assert.throws(()=>editPreviewSticker(edited,'private-note',{scale:2}),/选择一个贴纸/);assert.deepEqual(removePreviewSticker(edited,'private-note'),edited);const removed=removePreviewSticker(edited,'sticker-qa');assert.deepEqual(removed.items,added.items.slice(0,3));assert.equal(removed.visible,false);assert.equal(removed.widget.quote,'私人组件句子');assert.equal(added.items[3].scale,1);
});
