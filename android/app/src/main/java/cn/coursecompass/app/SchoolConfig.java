package cn.coursecompass.app;
import java.net.URI;import java.util.*;import org.json.*;
/** Explicit origin allow-list. Adding a school never grants its web page the app bridge. */
final class SchoolConfig {
 final String id,name,adapter,login,table,home,host;final Set<String> hosts;final boolean builtIn;
 private SchoolConfig(String i,String n,String a,String l,String t,String h,Set<String> allowed,boolean b)throws Exception{id=i;name=n;adapter=a;login=l;table=t;home=h;host=t.isEmpty()?"":new URI(t).getHost();hosts=Collections.unmodifiableSet(allowed);builtIn=b;}
 static SchoolConfig defaults()throws Exception{return new SchoolConfig("gzist-zfsoft","广州理工学院","zfsoft","https://portal.gzist.edu.cn/","http://jw.gzist.edu.cn/jwglxt/kbcx/xskbcxMobile_cxTimeTableIndex.html?gnmkdm=Y253511&hasHeader=true","https://jw.gzist.edu.cn/jwglxt/",new HashSet<>(Arrays.asList("jw.gzist.edu.cn","portal.gzist.edu.cn","ids.gzist.edu.cn")),true);}
 private static URI secure(String value)throws Exception{URI u=new URI(value);if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getPort()!=-1)throw new IllegalArgumentException("学校网址需为HTTPS");return u;}
 static SchoolConfig parse(String text)throws Exception{JSONObject o=new JSONObject(text);if("gzist-zfsoft".equals(o.optString("id")))return defaults();if("manual".equals(o.optString("id")))return new SchoolConfig("manual","通用课表 · 任意学校","manual","","","",new HashSet<>(),false);
  String name=o.getString("name").trim(),adapter="zfsoft".equals(o.optString("adapter"))?"zfsoft":"manual";if(name.isEmpty()||name.length()>60)throw new IllegalArgumentException("学校名称无效");URI login=secure(o.getString("loginUrl")),table=secure(o.optString("timetableUrl",login.toString()));if("zfsoft".equals(adapter)&&!table.getPath().startsWith("/jwglxt/kbcx/"))throw new IllegalArgumentException("不是正方课表入口");Set<String> hosts=new HashSet<>(Arrays.asList(login.getHost(),table.getHost()));JSONArray extra=o.optJSONArray("hosts");if(extra!=null){if(extra.length()>10)throw new IllegalArgumentException("域名过多");for(int i=0;i<extra.length();i++){String h=extra.getString(i).toLowerCase(Locale.ROOT);if(!h.matches("[a-z0-9.-]+")||!h.contains(".")||h.contains(".."))throw new IllegalArgumentException("域名无效");hosts.add(h);}}
  return new SchoolConfig("custom-"+table.getHost(),name,adapter,login.toString(),table.toString(),"https://"+table.getHost()+"/jwglxt/",hosts,false);
 }
 boolean data(String value){try{URI u=new URI(value);return host.equals(u.getHost())&&u.getUserInfo()==null&&u.getPort()==-1&&("https".equals(u.getScheme())||builtIn&&"http".equals(u.getScheme()));}catch(Exception e){return false;}}
 boolean official(String value){try{URI u=new URI(value);return data(value)||"https".equals(u.getScheme())&&u.getUserInfo()==null&&u.getPort()==-1&&hosts.contains(u.getHost());}catch(Exception e){return false;}}
 Set<String> origins(){Set<String> result=new HashSet<>();if(!host.isEmpty()){result.add("https://"+host);if(builtIn)result.add("http://"+host);}return result;}
}
