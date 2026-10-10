package cn.coursecompass.app;
import java.util.zip.*;
import java.util.Arrays;
public final class ApkFilesCheck {
 public static void main(String[] args)throws Exception{
  int count=0;try(ZipFile zip=new ZipFile(args[0])){java.util.Enumeration<? extends ZipEntry> all=zip.entries();while(all.hasMoreElements()){ZipEntry e=all.nextElement();if(!e.getName().startsWith("assets/")||e.isDirectory())continue;byte[] expected;try(java.io.InputStream in=zip.getInputStream(e)){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);expected=out.toByteArray();}byte[] actual=ApkFiles.read(args[0],e.getName().substring(7));if(!Arrays.equals(actual,expected))throw new AssertionError(e.getName());count++;}}
  try{ApkFiles.read(args[0],"../AndroidManifest.xml");throw new AssertionError("Traversal accepted");}catch(java.io.IOException expected){}
  String html=new String(ApkFiles.read(args[0],"demo/index.html"),"UTF-8");if(!html.contains("id=\"timetable\""))throw new AssertionError("Launch HTML missing timetable");System.out.println("PASS: read "+count+" actual APK assets byte-for-byte through startup fallback; traversal rejected");
 }
}
