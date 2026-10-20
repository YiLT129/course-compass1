package cn.coursecompass.app;
/** Platform-independent widget appearance validation, shared by rendering and settings. */
final class WidgetStyle {
 final String style,content,quote,accent;final int opacity;
 WidgetStyle(String style,String content,String quote,String accent,int opacity){this.style="pixel".equals(style)||"record".equals(style)?style:"glass";this.content="date".equals(content)||"quote".equals(content)?content:"course";String text=quote==null||quote.isEmpty()?"留一点时间，给喜欢的事":quote;this.quote=text.substring(0,Math.min(60,text.length()));this.accent=accent!=null&&accent.matches("#[0-9a-fA-F]{6}")?accent:"#368bc1";this.opacity=Math.max(40,Math.min(100,opacity));}
 int background(){int rgb=Integer.parseInt(accent.substring(1),16),target="glass".equals(style)?0xffffff:0x10212c;double weight="glass".equals(style)?.12:.35;int color=0;for(int shift:new int[]{16,8,0})color|=((int)Math.round(((rgb>>shift)&255)*weight+((target>>shift)&255)*(1-weight)))<<shift;return (Math.round(opacity*255f/100)<<24)|color;}
 int foreground(){return "glass".equals(style)?0xff183d52:"pixel".equals(style)?0xffd3fca3:0xffedf8ff;}
}
