package cn.coursecompass.app;

/** Pure path mapping shared by both WebView interception callbacks. */
final class AssetRoutes {
 static String assetPath(String path){
  if(path==null||path.isEmpty()||"/".equals(path))return "demo/index.html";
  if(!path.startsWith("/")||path.indexOf('\\')>=0||path.indexOf('\0')>=0)return null;
  for(String segment:path.split("/"))if("..".equals(segment)||".".equals(segment))return null;
  String result=path.substring(1);if("demo".equals(result)||result.endsWith("/"))result+=(result.endsWith("/")?"":"/")+"index.html";
  return result;
 }
 static String mime(String path){
  if(path.endsWith(".js")||path.endsWith(".mjs"))return "text/javascript";
  if(path.endsWith(".css"))return "text/css";
  if(path.endsWith(".svg"))return "image/svg+xml";
  if(path.endsWith(".json")||path.endsWith(".webmanifest"))return "application/json";
  if(path.endsWith(".html"))return "text/html";
  if(path.endsWith(".png"))return "image/png";
  if(path.endsWith(".jpg")||path.endsWith(".jpeg"))return "image/jpeg";
  if(path.endsWith(".webp"))return "image/webp";
  if(path.endsWith(".wasm"))return "application/wasm";
  return "application/octet-stream";
 }
}
