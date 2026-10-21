package cn.coursecompass.app;

import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.CookieManager;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.ConsoleMessage;
import android.util.Log;
import android.content.res.AssetManager;
import android.os.Build;
import android.widget.ScrollView;
import androidx.webkit.WebViewAssetLoader;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** App WebView and school WebView are separate. Only the app has a native bridge. */
public class MainActivity extends Activity {
 private static final String APP_HOST="appassets.androidplatform.net";
 private SchoolConfig schoolConfig;
 private String collectorBase,gradeBase;
 private WebView appView, portalView;
 private Dialog portalDialog;
 private boolean appBackPending=false;
 private android.window.OnBackInvokedCallback appBackCallback;
 private String timetableUrl,collectorScript,gradeScript;
 private boolean profileMode=false,gradeMode=false,gradeDelivering=false,forceRead=false;
 private int gradeYear=2026,gradeTerm=3;
 private boolean gradeScopeKnown=false;
 private String schoolHome="https://jw.gzist.edu.cn/jwglxt/";
 private String gradeState="waiting",gradeReason="尚未查询成绩",gradeSource="未识别";
 private int gradePageRecords=0;
 private String pendingExport;
 private byte[] pendingBinary;
 private int widgetToConfigure=0;
 private TextView portalStatus;
 private Button readButton;
 private TextView gradeScopeLabel;
 private LinearLayout recoveryActions;
 private JSONObject capturedTimetable,capturedQuery;
 private boolean reading=false,earlyCollector=false,frameMessages=false;
 private int readGeneration=0,capturedFrames=0,capturedRequests=0;
 private final java.util.ArrayList<androidx.webkit.JavaScriptReplyProxy> schoolFrameReplies=new java.util.ArrayList<>();
 private boolean syncing=false,replayed=false;
 private int syncRetries=0;

 private final Handler handler=new Handler(Looper.getMainLooper());
 private ValueCallback<Uri[]> fileCallback;
 private AssetManager bundledAssets;
 private WebViewAssetLoader assetLoader;
 private String startupStage="配置";
 private final StringBuilder webErrors=new StringBuilder();

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  widgetToConfigure=getIntent().getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID,0);
  if(android.appwidget.AppWidgetManager.ACTION_APPWIDGET_CONFIGURE.equals(getIntent().getAction()))setResult(RESULT_CANCELED);
  if(Build.VERSION.SDK_INT>=33){appBackCallback=this::handleAppBack;getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,appBackCallback);}
  bundledAssets=getAssets();
  getWindow().setStatusBarColor(Color.rgb(218,233,241));
  try {
   collectorBase=assetText("collector.js");gradeBase=assetText("grades-collector.js");
   try{applySchool(SchoolConfig.parse(getSharedPreferences("school-config",MODE_PRIVATE).getString("selected","{\"id\":\"gzist-zfsoft\"}")));}catch(Exception ignored){applySchool(SchoolConfig.defaults());}
   JSONObject school=new JSONObject(assetText("school.json"));

  } catch(Exception error){showStartupError("读取配置",error);return;}
  assetLoader=new WebViewAssetLoader.Builder()
   .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(getApplicationContext()))
   .addPathHandler("/",new WebViewAssetLoader.AssetsPathHandler(getApplicationContext())).build();
  try{startupStage="校验启动文件";assetText("demo/index.html");startupStage="创建 WebView";appView=new WebView(this);}catch(Exception error){showStartupError(startupStage,error);return;}
  configure(appView);
  appView.addJavascriptInterface(new AppBridge(),"CourseCompass");
  appView.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
    try{startActivityForResult(intent,42);}catch(Exception ignored){fileCallback.onReceiveValue(null);fileCallback=null;}return true;
   }
   @Override public boolean onJsConfirm(WebView view,String url,String message,android.webkit.JsResult result){
    new android.app.AlertDialog.Builder(MainActivity.this).setTitle("确认更新成绩").setMessage(message).setNegativeButton("保留原成绩",(dialog,which)->result.cancel()).setPositiveButton("使用本次结果",(dialog,which)->result.confirm()).setOnCancelListener(dialog->result.cancel()).show();return true;
   }
   @Override public boolean onConsoleMessage(ConsoleMessage message){Log.d("CourseCompassWeb",message.message()+" at "+message.sourceId()+":"+message.lineNumber());if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR&&webErrors.length()<6000)webErrors.append(message.message()).append("\n");return true;}
  });

  appView.setWebViewClient(new WebViewClient(){
   @Override public void onPageFinished(WebView view,String url){if(view==appView&&widgetToConfigure>0)openWidgetWhenReady(0);}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();if(APP_HOST.equals(uri.getHost())&&"https".equals(uri.getScheme()))return false;
    openExternal(uri);return true;
   }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    return localResponse(request.getUrl());
   }
   @Override @SuppressWarnings("deprecation") public WebResourceResponse shouldInterceptRequest(WebView view,String url){return localResponse(Uri.parse(url));}
  });
  FrameLayout appRoot=new FrameLayout(this);appRoot.setBackgroundColor(Color.rgb(218,233,241));
  appRoot.addView(appView,new FrameLayout.LayoutParams(-1,-1));applySafeArea(getWindow(),appRoot);setContentView(appRoot);appRoot.requestApplyInsets();
  try{startupStage="启动本地页面";appView.loadUrl("https://"+APP_HOST+"/assets/demo/index.html"+("cn.coursecompass.app.ROOM_CARD".equals(getIntent().getAction())?"#room":""));}catch(Exception error){showStartupError(startupStage,error);}
 }
 private WebResourceResponse localResponse(Uri uri){
  if(!APP_HOST.equals(uri.getHost())||!"https".equals(uri.getScheme()))return null;
  WebResourceResponse standard=assetLoader.shouldInterceptRequest(uri);
  if(standard!=null&&standard.getData()!=null&&standard.getStatusCode()<400)return standard;
  String raw=uri.getPath();if(raw!=null&&raw.startsWith("/assets/"))raw=raw.substring(7);
  String path=AssetRoutes.assetPath(raw);if(path==null)return errorResponse();
  try{byte[] bytes=ApkFiles.read(getApplicationInfo().sourceDir,path);String mime=AssetRoutes.mime(path);java.util.Map<String,String> headers=new java.util.HashMap<>();headers.put("Cache-Control","no-store");return new WebResourceResponse(mime,mime.startsWith("text/")?"UTF-8":null,200,"OK",headers,new ByteArrayInputStream(bytes));}catch(Exception error){Log.e("CourseCompassAssets","Asset failed: "+path,error);return errorResponse();}
 }
 private void showStartupError(String stage,Exception error){
  Log.e("CourseCompassStartup",stage,error);
  String details="课间 0.6.0 · 启动诊断\n\n阶段："+stage+"\n设备："+Build.MANUFACTURER+" "+Build.MODEL+" / Android "+Build.VERSION.RELEASE+"\n错误："+error.getClass().getName()+"\n"+String.valueOf(error.getMessage());
  for(StackTraceElement frame:error.getStackTrace())if(frame.getClassName().startsWith("cn.coursecompass"))details+="\n"+frame.toString();
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(28,100,28,40);
  TextView title=new TextView(this);title.setText("应用启动遇到问题");title.setTextSize(21);box.addView(title);
  TextView text=new TextView(this);text.setText(details);text.setTextSize(13);text.setTextIsSelectable(true);text.setPadding(0,28,0,28);box.addView(text);
  final String report=details;box.addView(button("复制诊断信息",()->{android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);clipboard.setPrimaryClip(android.content.ClipData.newPlainText("课间启动诊断",report));Toast.makeText(this,"已复制",Toast.LENGTH_SHORT).show();}));box.addView(button("重试",()->recreate()));
  ScrollView scroll=new ScrollView(this);scroll.addView(box);applySafeArea(getWindow(),scroll);setContentView(scroll);scroll.requestApplyInsets();
 }

 private void configure(WebView view){view.getSettings().setJavaScriptEnabled(true);view.getSettings().setDomStorageEnabled(true);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);view.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);}
 private String assetText(String name)throws Exception{try(InputStream stream=openBundled(name)){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;while((count=stream.read(buffer))!=-1)out.write(buffer,0,count);return out.toString("UTF-8");}}
 private InputStream openBundled(String name)throws Exception{try{return bundledAssets.open(name);}catch(java.io.IOException error){Log.w("CourseCompassAssets","AssetManager failed; reading own APK: "+name,error);return new ByteArrayInputStream(ApkFiles.read(getApplicationInfo().sourceDir,name));}}
 private WebResourceResponse errorResponse(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,new ByteArrayInputStream(new byte[0]));}
 private void openExternal(Uri uri){if(!"http".equals(uri.getScheme())&&!"https".equals(uri.getScheme()))return;try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){Toast.makeText(this,"无法打开链接",Toast.LENGTH_SHORT).show();}}
 private boolean isOfficial(String url){return schoolConfig!=null&&schoolConfig.official(url);}
 private boolean isSchool(String url){return schoolConfig!=null&&schoolConfig.data(url);}
 private android.content.SharedPreferences schoolPrefs(){return getSharedPreferences(schoolConfig.builtIn?"school":"school-"+schoolConfig.id,MODE_PRIVATE);}
 private void applySchool(SchoolConfig value){schoolConfig=value;timetableUrl=value.table;schoolHome=value.home;String seed="window.__courseCompassSchoolHost="+JSONObject.quote(value.host)+";\n";collectorScript=seed+collectorBase;gradeScript=seed+gradeBase;}

 private final class AppBridge {
  @JavascriptInterface public boolean setSchool(String text){try{if(text==null||text.length()>10000)return false;SchoolConfig next=SchoolConfig.parse(text);if(!getSharedPreferences("school-config",MODE_PRIVATE).edit().putString("selected",text).commit())return false;applySchool(next);runOnUiThread(()->{if(portalDialog!=null&&portalDialog.isShowing())portalDialog.dismiss();});return true;}catch(Exception error){return false;}}
  @JavascriptInterface public void haptic(){runOnUiThread(()->{if(appView!=null)appView.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK);});}
  @JavascriptInterface public String getWidgetConfigs(){return CourseCompanion.configs(MainActivity.this);}
  @JavascriptInterface public boolean setWidgetConfig(int id,String text){boolean ok=CourseCompanion.saveConfig(MainActivity.this,id,text);if(ok&&id==widgetToConfigure&&android.appwidget.AppWidgetManager.ACTION_APPWIDGET_CONFIGURE.equals(getIntent().getAction()))runOnUiThread(()->{setResult(RESULT_OK,new Intent().putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID,id));finish();});return ok;}
  @JavascriptInterface public void openLink(String url){if(url!=null&&url.length()<4000)runOnUiThread(()->openExternal(Uri.parse(url)));}
  @JavascriptInterface public void saveImage(String name,String data){try{byte[] bytes=decodePng(data);startExport(name,"image/png",null,bytes);}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"图片无法保存："+e.getMessage(),Toast.LENGTH_LONG).show());}}
  @JavascriptInterface public void shareImage(String data){try{byte[] bytes=decodePng(data);runOnUiThread(()->sharePng(bytes));}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"图片无法分享："+e.getMessage(),Toast.LENGTH_LONG).show());}}
  @JavascriptInterface public String getCompanionStatus(){return CourseCompanion.status(MainActivity.this);}
  @JavascriptInterface public void updateSchedule(String text){runOnUiThread(()->{try{CourseCompanion.update(MainActivity.this,text);}catch(Exception error){companionChanged("课程卡片同步失败，请检查学期与作息");}});}
  @JavascriptInterface public void setCompanionEnabled(boolean value){runOnUiThread(()->{
   if(value&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},63);return;}
   CourseCompanion.enabled(MainActivity.this,value);companionChanged(value?"已开启；请在系统通知设置允许锁屏显示":"锁屏课程通知已关闭");
  });}
  @JavascriptInterface public void pinCourseWidget(){runOnUiThread(()->{android.appwidget.AppWidgetManager manager=android.appwidget.AppWidgetManager.getInstance(MainActivity.this);if(manager.isRequestPinAppWidgetSupported()){manager.requestPinAppWidget(new android.content.ComponentName(MainActivity.this,CourseWidget.class),null,null);companionChanged("请确认添加课程卡片");}else companionChanged("请长按桌面，在小组件中找到课间");});}
  @JavascriptInterface public void openReminderSettings(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=31&&!CourseCompanion.exactAllowed(MainActivity.this))try{startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));}catch(Exception e){companionChanged("请在系统设置允许闹钟与提醒");}else companionChanged("已允许按课程时间更新");});}
  @JavascriptInterface public void openNotificationSettings(){runOnUiThread(()->{try{startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getPackageName()));}catch(Exception e){companionChanged("请在系统设置中打开课间的通知权限");}});}
  @JavascriptInterface public void openPortal(){runOnUiThread(()->{gradeMode=false;profileMode=false;showPortal(false);});}
  @JavascriptInterface public void openProfile(){runOnUiThread(()->{gradeMode=false;profileMode=true;showPortal(false);});}
  @JavascriptInterface public void syncPortal(){runOnUiThread(()->{gradeMode=false;profileMode=false;showPortal(true);});}
  @JavascriptInterface public void openGrades(int year,int term){if(year<2000||year>2099||term!=3&&term!=12&&term!=16)return;runOnUiThread(()->{if(portalDialog!=null&&portalDialog.isShowing())return;gradeMode=true;profileMode=false;gradeYear=year;gradeTerm=term;showPortal(false);});}
  @JavascriptInterface public void saveFile(String name,String mime,String content){
   if(content==null)return;if(content.length()>70_000_000){runOnUiThread(()->Toast.makeText(MainActivity.this,"备份文件过大，请减少图片后重试",Toast.LENGTH_LONG).show());return;}
   startExport(name,"text/calendar".equals(mime)?"text/calendar":"application/json",content,null);
  }

 }
 private void startExport(String name,String mime,String content,byte[] binary){runOnUiThread(()->{if(pendingExport!=null||pendingBinary!=null){Toast.makeText(this,"请先完成当前导出",Toast.LENGTH_SHORT).show();return;}pendingExport=content;pendingBinary=binary;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,(name==null?"课间导出":name).replaceAll("[\\\\/]","_"));try{startActivityForResult(intent,41);}catch(Exception e){pendingExport=null;pendingBinary=null;Toast.makeText(this,"无法打开文件保存窗口",Toast.LENGTH_LONG).show();}});}
 private byte[] decodePng(String data)throws Exception{if(data==null||data.length()>22_000_000)throw new Exception("图片超过16MB");byte[] bytes=android.util.Base64.decode(data,android.util.Base64.DEFAULT);byte[] magic={(byte)137,80,78,71,13,10,26,10};if(bytes.length<magic.length)throw new Exception("PNG格式无效");for(int i=0;i<magic.length;i++)if(bytes[i]!=magic[i])throw new Exception("PNG格式无效");return bytes;}
 private void sharePng(byte[] bytes){try{java.io.File folder=new java.io.File(getCacheDir(),"shared");if(!folder.exists()&&!folder.mkdirs())throw new Exception("缓存目录不可用");java.io.File[] old=folder.listFiles();if(old!=null)for(java.io.File f:old)if(f.lastModified()<System.currentTimeMillis()-86400000L)f.delete();java.io.File file=new java.io.File(folder,"course-compass-"+System.currentTimeMillis()+".png");try(OutputStream out=new java.io.FileOutputStream(file)){out.write(bytes);}Uri uri=androidx.core.content.FileProvider.getUriForFile(this,getPackageName()+".images",file);Intent intent=new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(android.content.ClipData.newRawUri("课表海报",uri));startActivity(Intent.createChooser(intent,"分享我的一周"));}catch(Exception e){Toast.makeText(this,"未能打开分享，请尝试保存PNG",Toast.LENGTH_LONG).show();}}
 private void openWidgetWhenReady(int attempt){if(appView==null||widgetToConfigure<=0||attempt>30||!CourseCompanion.owns(this,widgetToConfigure))return;appView.evaluateJavascript("typeof window.openWidgetEditor==='function'",ready->{if("true".equals(ready)){appView.evaluateJavascript("window.openWidgetEditor("+widgetToConfigure+")",null);}else handler.postDelayed(()->openWidgetWhenReady(attempt+1),150);});}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if("cn.coursecompass.app.ROOM_CARD".equals(intent.getAction())&&appView!=null)appView.evaluateJavascript("location.hash='room'",null);widgetToConfigure=intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID,0);if(widgetToConfigure>0)openWidgetWhenReady(0);}
 private void companionChanged(String message){if(appView!=null)appView.evaluateJavascript("window.onNativeCompanionChanged&&window.onNativeCompanionChanged("+JSONObject.quote(message)+")",null);}
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==63){boolean granted=results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED;CourseCompanion.enabled(this,granted);companionChanged(granted?"课程通知已开启，请允许锁屏显示":"未获得通知权限，桌面课程卡片仍可使用");}}
 @Override protected void onResume(){super.onResume();CourseCompanion.refresh(this);companionChanged("");}
 private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
 private void applySafeArea(Window window,View root){
  window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
  if(Build.VERSION.SDK_INT>=30)window.setDecorFitsSystemWindows(false);
  else window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
  if(Build.VERSION.SDK_INT>=30&&window.getInsetsController()!=null)window.getInsetsController().setSystemBarsAppearance(android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
  root.setOnApplyWindowInsetsListener((view,insets)->{
   int left,top,right,bottom;
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());left=safe.left;top=safe.top;right=safe.right;bottom=safe.bottom;}
   else{left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();}
   view.setPadding(left,top,right,bottom);
   return Build.VERSION.SDK_INT>=30?WindowInsets.CONSUMED:insets.consumeSystemWindowInsets();
  });
 }
 private Button button(String title,Runnable action){Button b=new Button(this);b.setText(title);b.setTextSize(13);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(8),0,dp(8),0);b.setOnClickListener(v->action.run());return b;}
 private void status(String message,boolean failed){if(syncing&&!gradeMode&&!profileMode&&appView!=null)appView.evaluateJavascript("window.onSchoolSyncStatus&&window.onSchoolSyncStatus("+JSONObject.quote(message)+")",null);if(portalStatus!=null){portalStatus.setText(message);portalStatus.setTextColor(failed?Color.rgb(159,58,51):Color.rgb(57,91,112));}if(recoveryActions!=null)recoveryActions.setVisibility(failed?View.VISIBLE:View.GONE);}
 private void finishRead(String message){if(gradeMode){gradeReason=message;if(!"blocked".equals(gradeState)&&!"login".equals(gradeState))gradeState="failed";}readGeneration++;reading=false;gradeDelivering=false;if(readButton!=null){readButton.setEnabled(true);readButton.setText(gradeMode?"读取成绩":profileMode?"读取身份":"读取课表");}status(message,true);}
 private void showPortal(boolean sync){
  if(!"zfsoft".equals(schoolConfig.adapter)){if(!schoolConfig.login.isEmpty())openExternal(Uri.parse(schoolConfig.login));else Toast.makeText(this,"请使用通用表格导入课表",Toast.LENGTH_LONG).show();return;}
  if(portalDialog!=null&&portalDialog.isShowing())return;
  syncRetries=0;gradeScopeKnown=false;gradeState="waiting";gradeReason="尚未查询成绩";syncing=sync;forceRead=sync;replayed=false;reading=false;readGeneration++;capturedTimetable=null;capturedQuery=null;capturedFrames=0;capturedRequests=0;schoolFrameReplies.clear();
  portalDialog=new Dialog(this,android.R.style.Theme_Material_Light_NoActionBar);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(245,249,252));
  LinearLayout toolbar=new LinearLayout(this);toolbar.setPadding(dp(6),dp(4),dp(6),dp(4));
  toolbar.addView(button("关闭",()->portalDialog.dismiss()),new LinearLayout.LayoutParams(0,dp(40),1));
  toolbar.addView(button("登录",()->portalView.loadUrl(schoolConfig.login)),new LinearLayout.LayoutParams(0,dp(40),1));
  toolbar.addView(button(gradeMode||profileMode?"教务首页":"课表入口",()->portalView.loadUrl(gradeMode||profileMode?schoolHome:timetableUrl)),new LinearLayout.LayoutParams(0,dp(40),1));
  readButton=button(gradeMode?"读取成绩":profileMode?"读取身份":"读取课表",()->{if(gradeMode)readGrades();else if(profileMode)readIdentity();else readPortal();});toolbar.addView(readButton,new LinearLayout.LayoutParams(0,dp(40),1));
  portalStatus=new TextView(this);portalStatus.setTextSize(11);portalStatus.setPadding(dp(14),dp(4),dp(14),dp(8));portalStatus.setMinLines(2);portalStatus.setMaxLines(6);
  recoveryActions=new LinearLayout(this);recoveryActions.setPadding(dp(6),0,dp(6),dp(4));recoveryActions.setVisibility(View.GONE);
  recoveryActions.addView(button("重新查询",()->{if(portalView!=null)portalView.reload();}),new LinearLayout.LayoutParams(0,dp(34),1));
  recoveryActions.addView(button("复制读取诊断",()->copyPortalReport()),new LinearLayout.LayoutParams(0,dp(34),1));

  portalView=new WebView(this);configure(portalView);portalView.getSettings().setUseWideViewPort(true);portalView.getSettings().setLoadWithOverviewMode(true);portalView.getSettings().setTextZoom(100);
  // No unrestricted JavaScript interface on the school page. Messages are scoped to exact school origins, including frames.
  java.util.Set<String> schoolOrigins=schoolConfig.origins();
  frameMessages=WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
  earlyCollector=WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
  if(frameMessages)WebViewCompat.addWebMessageListener(portalView,"CourseCompassCapture",schoolOrigins,(view,message,origin,mainFrame,reply)->{
   if(view!=portalView||!isSchool(origin.toString()))return;
   String text=message.getData();if(text==null||text.length()>2_000_000)return;
   try{JSONObject packet=new JSONObject(text);String type=packet.optString("type");
    if("ready".equals(type)){capturedFrames++;if(schoolFrameReplies.size()<8)schoolFrameReplies.add(reply);}
    if("status".equals(type)){capturedRequests=Math.max(capturedRequests,packet.optInt("requests"));if(reading&&packet.has("reason")){if(packet.optBoolean("failed"))finishRead(packet.optString("reason"));else status(packet.optString("reason"),false);}}
    if("schoolProfile".equals(type)){deliverProfile(packet.getJSONObject("profile"));return;}
    if("gradesReady".equals(type)){gradeSource=packet.optString("source","school-query");gradePageRecords=packet.optInt("count",0);if(!reading)adoptGradeScope(packet);if(!"school-page".equals(gradeSource))capturedRequests++;gradeState="ready";gradeReason=packet.optString("reason");
     String entry=packet.optString("entry","");String valid=validGradeEntry(entry);if(valid!=null)schoolPrefs().edit().putString("gradeEntry",valid).apply();
     schoolStatus("ready","已识别学校成绩查询，登录会话可能随学校策略失效");
     if(gradeMode&&!reading)status(packet.optString("reason"),false);return;
    }
    if(gradeMode&&"gradesCaptureError".equals(type)){finishRead(packet.optString("reason","学校成绩格式暂无法识别"));return;}
    if(gradeMode&&"gradesState".equals(type)){handleGradeState(packet);return;}
    if(gradeMode&&"gradesError".equals(type)){if(!reading||packet.optInt("requestId",-1)!=readGeneration)return;gradeReason=packet.optString("reason","成绩读取失败");finishRead(gradeReason);schoolStatus("failed",gradeReason);return;}
    if(gradeMode&&reading&&"grades".equals(type)){if(packet.optInt("requestId",-1)!=readGeneration)return;deliverGrades(packet.getJSONObject("data"),readGeneration);return;}
    if(gradeMode||profileMode)return;
    if("timetable".equals(type)){if(reading&&!packet.optBoolean("readResult"))return;JSONObject data=packet.getJSONObject("data");if(data.getJSONArray("kbList").length()==0)return;capturedTimetable=data;capturedQuery=packet.optJSONObject("query");status("已捕获 "+data.getJSONArray("kbList").length()+" 条排课，点「读取课表」核对后导入。",false);if(syncing&&!reading&&syncRetries<3){syncRetries++;readPortal();}}
   }catch(Exception error){status("学校返回的数据未能识别，请在学期课表重新查询。",true);}
  });
  if(earlyCollector)WebViewCompat.addDocumentStartJavaScript(portalView,collectorScript+"\n"+gradeScript,schoolOrigins);
  portalView.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){if(isOfficial(request.getUrl().toString()))return false;openExternal(request.getUrl());return true;}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){if(view!=portalView)return;if(syncing)replayed=false;capturedTimetable=null;capturedQuery=null;capturedFrames=0;capturedRequests=0;gradeSource="未识别";gradePageRecords=0;gradeScopeKnown=false;if(gradeScopeLabel!=null)gradeScopeLabel.setText("自动跟随学校页面 · 正在识别学期");schoolFrameReplies.clear();readGeneration++;reading=false;gradeDelivering=false;readButton.setEnabled(true);readButton.setText(gradeMode?"读取成绩":profileMode?"读取身份":"读取课表");status(gradeMode?"页面加载中…登录后可读取所选学期成绩。":profileMode?"页面加载中…登录后进入个人信息，再点读取身份。":"页面加载中…登录后选择学期课表，再点「读取课表」。",false);}
   @Override public void onPageCommitVisible(WebView view,String url){if(isSchool(url))view.evaluateJavascript(collectorScript+"\n"+gradeScript,null);}
   @Override public void onPageFinished(WebView view,String url){
    if(view!=portalView)return;CookieManager.getInstance().flush();
    if(profileMode){if(isSchool(url))view.evaluateJavascript(gradeScript+"\nwindow.__courseCompassGrades&&window.__courseCompassGrades.profile();",null);status("登录后进入教务系统的「个人信息」，显示姓名和学号后点「读取身份」。无需先读取成绩。",false);return;}
    if(gradeMode){
     if(isSchool(url))view.evaluateJavascript(collectorScript+"\n"+gradeScript,ignored->{if(portalView==view)view.evaluateJavascript("JSON.stringify(window.__courseCompassGrades.inspect())",result->{if(portalView!=view)return;try{Object outer=new JSONTokener(result).nextValue();if(outer instanceof String)handleGradeState(new JSONObject((String)outer));}catch(Exception e){finishRead("无法识别学校页面，请回教务首页重新进入成绩查询。");}});});
     else{status("请在学校官方门户完成登录，再进入「成绩查询」。读取时自动跟随学校页面选择的学期。",false);schoolStatus("login","请在学校官方页面完成登录");}return;
    }
    if(capturedTimetable==null)status(syncing?"登录完成后将继续本次课表同步，无需返回重新点击刷新。":"登录后打开学期课表并查询，再点「读取课表」。",false);
    if(isSchool(url))view.evaluateJavascript(collectorScript,ignored->{if(syncing&&!replayed){replayed=true;String saved=schoolPrefs().getString("query",null);if(saved==null){readPortal();return;}try{JSONObject query=new JSONObject(saved);String seed="(function(){var c=window.__courseCompassCollector;if(c)c.recipe="+query.toString()+";})()";view.evaluateJavascript(seed,done->readPortal());}catch(Exception error){readPortal();}}});
   }
   @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){if(view==portalView&&request.isForMainFrame())finishRead("学校页面加载失败："+error.getDescription()+"。可点登录或教务首页重试。");}
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(view==portalView&&request.isForMainFrame())finishRead("学校页面返回 HTTP "+response.getStatusCode()+"，请点教务首页或重新登录。原有数据已保留。");}
  });
  root.addView(toolbar,new LinearLayout.LayoutParams(-1,dp(48)));if(gradeMode){gradeScopeLabel=new TextView(this);gradeScopeLabel.setText("自动跟随学校页面 · 待识别学期");gradeScopeLabel.setTextSize(13);gradeScopeLabel.setGravity(android.view.Gravity.CENTER);gradeScopeLabel.setTextColor(Color.rgb(30,105,145));root.addView(gradeScopeLabel,new LinearLayout.LayoutParams(-1,dp(36)));}root.addView(portalStatus,new LinearLayout.LayoutParams(-1,-2));root.addView(recoveryActions,new LinearLayout.LayoutParams(-1,-2));root.addView(portalView,new LinearLayout.LayoutParams(-1,0,1));
  portalDialog.setContentView(root);applySafeArea(portalDialog.getWindow(),root);
  portalDialog.setOnDismissListener(dialog->{handler.removeCallbacksAndMessages(null);readGeneration++;reading=false;syncing=false;CookieManager.getInstance().flush();portalView.destroy();portalView=null;portalStatus=null;readButton=null;gradeScopeLabel=null;recoveryActions=null;capturedTimetable=null;capturedQuery=null;});
  portalDialog.show();
  final Dialog currentPortal=portalDialog;
  if(Build.VERSION.SDK_INT>=33)currentPortal.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{if(portalDialog==currentPortal)handlePortalBack();});
  else currentPortal.setOnKeyListener((dialog,key,event)->{if(key!=android.view.KeyEvent.KEYCODE_BACK)return false;if(event.getAction()==android.view.KeyEvent.ACTION_UP&&!event.isCanceled())handlePortalBack();return true;});
  root.requestApplyInsets();status(gradeMode?"在学校页面选择学期，等成绩显示后点上方读取成绩。学校会话仅保存在本机。":profileMode?"在学校官方门户登录，进入教务「个人信息」，显示姓名与学号后点「读取身份」。":"在学校页面登录，选择学期课表后读取。登录会话仅保存在本机。",false);String savedEntry=schoolPrefs().getString("gradeEntry",null);String checkedEntry=validGradeEntry(savedEntry);portalView.loadUrl(gradeMode?(checkedEntry==null?schoolHome:checkedEntry):sync?timetableUrl:schoolConfig.login);
 }
 private void deliverProfile(JSONObject profile){
  if(appView==null)return;
  appView.evaluateJavascript("(function(){try{return JSON.stringify(window.receiveSchoolProfile("+JSONObject.quote(profile.toString())+"));}catch(e){return JSON.stringify({ok:false});}})()",result->{try{Object outer=new JSONTokener(result).nextValue();JSONObject response=new JSONObject((String)outer);if(response.optBoolean("ok")&&profileMode&&portalView!=null){reading=false;readGeneration++;if(readButton!=null){readButton.setEnabled(true);readButton.setText("读取身份");}status("姓名与学号已保存在本机。点「关闭」返回用户页，之后可独立同步成绩。",false);}}catch(Exception ignored){}});
 }
 private void readIdentity(){
  if(portalView==null||reading)return;reading=true;int operation=++readGeneration;readButton.setEnabled(false);readButton.setText("读取中…");status("正在读取学校页面中的姓名与学号…",false);
  for(androidx.webkit.JavaScriptReplyProxy reply:schoolFrameReplies)try{reply.postMessage("{\"type\":\"readProfile\"}");}catch(Exception ignored){}
  portalView.evaluateJavascript(gradeScript+"\nJSON.stringify(window.__courseCompassGrades&&window.__courseCompassGrades.profile())",result->{if(portalView==null||operation!=readGeneration)return;try{Object outer=new JSONTokener(result).nextValue();if(outer instanceof String){JSONObject value=new JSONObject((String)outer);if(value.has("name")&&value.has("studentId"))deliverProfile(value);}}catch(Exception ignored){}});
  handler.postDelayed(()->{if(portalView!=null&&operation==readGeneration&&reading)finishRead("当前页面还没有可核实的姓名和学号。请点「教务首页」，打开学校「个人信息」后再读取；不会从登录输入框猜测身份。");},1800);
 }
 private void readPortal(){
  if(portalView==null||reading)return;
  reading=true;int operation=++readGeneration;readButton.setEnabled(false);readButton.setText("读取中…");status("正在读取课表，请稍候…",false);
  capturedTimetable=null;capturedQuery=null;portalView.evaluateJavascript("window.__compassReadResult=null",null);
  for(androidx.webkit.JavaScriptReplyProxy frame:schoolFrameReplies){try{frame.postMessage("{\"type\":\"read\",\"force\":"+forceRead+"}");}catch(Exception ignored){}}
  // Check the current school page and accessible school frames. Cross-origin frames use the origin-scoped message listener.
  String probe="(function(){function scan(w){try{if(w.location.hostname==="+JSONObject.quote(schoolConfig.host)+"){w.eval("+JSONObject.quote(collectorScript)+");var c=w.__courseCompassCollector;if(c){c.obtain("+forceRead+").then(function(data){if(data)w.__compassReadResult={data:data,query:c.recipe};});}}for(var i=0;i<w.frames.length;i++){var r=scan(w.frames[i]);if(r)return r;}}catch(e){}return null;}return JSON.stringify(scan(window));})()";
  portalView.evaluateJavascript(probe,result->{if(portalView==null||operation!=readGeneration)return;
   try{Object decoded=new JSONTokener(result).nextValue();if(decoded instanceof String){Object packet=new JSONTokener((String)decoded).nextValue();if(packet instanceof JSONObject){JSONObject obj=(JSONObject)packet;capturedTimetable=obj.getJSONObject("data");capturedQuery=obj.optJSONObject("query");}}}catch(Exception ignored){}
   pollRead(operation,System.currentTimeMillis()+12000);
  });
  handler.postDelayed(()->{if(portalView!=null&&reading&&operation==readGeneration){readGeneration++;finishRead("读取超时。请等待学校页面加载完成，再重试或复制读取诊断。");}},15000);
 }
 private void pollRead(int operation,long deadline){
  if(portalView==null||operation!=readGeneration||!reading)return;
  if(capturedTimetable!=null){deliverTimetable(capturedTimetable,capturedQuery,operation);return;}
  if(System.currentTimeMillis()>=deadline){finishRead("尚未获取完整课表。请选「学期课表」重新查询后再读取；仍失败时请复制读取诊断。查询数："+capturedRequests);return;}
  if(!frameMessages)portalView.evaluateJavascript("(function(){var r=window.__compassReadResult;return r?JSON.stringify(r):null;})()",result->{if(portalView==null||operation!=readGeneration)return;try{Object outer=new JSONTokener(result).nextValue();if(outer instanceof String){JSONObject packet=new JSONObject((String)outer);capturedTimetable=packet.getJSONObject("data");capturedQuery=packet.optJSONObject("query");}}catch(Exception ignored){}});
  handler.postDelayed(()->pollRead(operation,deadline),250);
 }
 private void deliverTimetable(JSONObject data,JSONObject query,int operation){
  final String payload=data.toString();
  String script="(function(){try{if(typeof window.receiveSchoolData!=='function')return JSON.stringify({ok:false,error:'导入界面尚未准备好，请关闭教务窗口后重试'});return JSON.stringify(window.receiveSchoolData("+JSONObject.quote(payload)+"));}catch(e){return JSON.stringify({ok:false,error:String(e.message||e)});}})()";
  appView.evaluateJavascript(script,result->{if(portalView==null||operation!=readGeneration)return;
   try{Object outer=new JSONTokener(result).nextValue();JSONObject response=new JSONObject((String)outer);if(!response.optBoolean("ok")){finishRead("课表解析失败："+response.optString("error"));return;}
    if(query!=null)schoolPrefs().edit().putString("query",query.toString()).apply();
    reading=false;CookieManager.getInstance().flush();portalDialog.dismiss();
   }catch(Exception error){finishRead("未收到导入预览确认，请重试或复制读取诊断。");}
  });
 }
 private String gradeScope(){return gradeYear+"–"+(gradeYear+1)+" 学年 · "+(gradeTerm==3?"第一学期":gradeTerm==12?"第二学期":"第三学期");}
 private void adoptGradeScope(JSONObject packet){
  int year=packet.optInt("year",0),term=packet.optInt("term",0);if(year<2000||year>2099||term!=3&&term!=12&&term!=16)return;
  gradeYear=year;gradeTerm=term;gradeScopeKnown=true;if(gradeScopeLabel!=null)gradeScopeLabel.setText("自动跟随 · "+gradeScope());
 }
 private String validGradeEntry(String value){
  if(value==null||value.isEmpty())return null;
  try{Uri u=Uri.parse(value.startsWith("/")?"https://"+schoolConfig.host+value:value);if(!isSchool(u.toString())||u.getPath()==null||!u.getPath().matches("/jwglxt/cjcx/[^/]+_cx[^/]+\\.html"))return null;
   Uri.Builder b=new Uri.Builder().scheme(u.getScheme()).authority(schoolConfig.host).path(u.getPath());for(String key:new String[]{"gnmkdm","hasHeader","layout"}){String v=u.getQueryParameter(key);if(v!=null&&v.matches("[A-Za-z0-9_-]{1,40}"))b.appendQueryParameter(key,v);}return b.build().toString();
  }catch(Exception e){return null;}
 }
 private void schoolStatus(String state,String reason){if(appView!=null)appView.evaluateJavascript("window.onSchoolStatus&&window.onSchoolStatus("+JSONObject.quote(state)+","+JSONObject.quote(reason)+")",null);}
 private void handleGradeState(JSONObject packet){
  if(!reading)adoptGradeScope(packet);
  gradeState=packet.optString("kind","waiting");gradeReason=packet.optString("reason","请在学校页面查询成绩后读取。");
  if("blocked".equals(gradeState)||"login".equals(gradeState)){
   if("blocked".equals(gradeState))schoolPrefs().edit().remove("gradeEntry").apply();
   finishRead(gradeReason);schoolStatus(gradeState,gradeReason);
  }else if(!reading)status(gradeReason,false);
 }
 private void readGrades(){
  if(portalView==null||reading)return;if(!isSchool(portalView.getUrl())&&schoolFrameReplies.isEmpty()){finishRead("请先点登录完成学校认证，再从学校菜单进入成绩查询。当前页面尚不能读取成绩。");return;}gradeDelivering=false;reading=true;int operation=++readGeneration;readButton.setEnabled(false);readButton.setText("读取中…");status("正在自动识别学校页面学期并读取成绩…",false);portalView.evaluateJavascript("window.__compassGradesResult=null;window.__compassGradeError=null",null);
  for(androidx.webkit.JavaScriptReplyProxy frame:schoolFrameReplies){try{frame.postMessage("{\"type\":\"readGrades\",\"year\":"+gradeYear+",\"term\":"+gradeTerm+",\"requestId\":"+operation+",\"followPage\":true}");}catch(Exception ignored){}}
  portalView.evaluateJavascript(collectorScript+"\n"+gradeScript,ignored->{if(portalView!=null&&operation==readGeneration)portalView.evaluateJavascript("(function(){var c=window.__courseCompassGrades;if(c)c.obtain("+gradeYear+","+gradeTerm+","+operation+",true).then(function(data){if(data)window.__compassGradesResult=data;});})()",null);});
  pollGrades(operation,System.currentTimeMillis()+45000);
 }
 private void pollGrades(int operation,long deadline){
  if(portalView==null||operation!=readGeneration||!reading||!gradeMode)return;
  if(System.currentTimeMillis()>=deadline){finishRead("成绩读取超时，已有成绩已保留。请在学校页面查询后重试。");return;}
  portalView.evaluateJavascript("window.__compassGradeError?JSON.stringify(window.__compassGradeError):window.__compassGradesResult?JSON.stringify(window.__compassGradesResult):null",result->{if(portalView==null||operation!=readGeneration||!reading)return;try{Object value=new JSONTokener(result).nextValue();if(value instanceof String){JSONObject data=new JSONObject((String)value);if(data.optInt("requestId",-1)!=operation)return;if(data.has("error"))finishRead(data.optString("error"));else deliverGrades(data,operation);}}catch(Exception ignored){}});
  handler.postDelayed(()->pollGrades(operation,deadline),500);
 }
 private void deliverGrades(JSONObject data,int operation){
  if(portalView==null||operation!=readGeneration||!reading||gradeDelivering)return;adoptGradeScope(data);gradeDelivering=true;
  appView.evaluateJavascript("(function(){try{return JSON.stringify(window.receiveSchoolGrades("+JSONObject.quote(data.toString())+"));}catch(e){return JSON.stringify({ok:false,error:String(e.message||e)});}})()",result->{if(portalView==null||operation!=readGeneration)return;try{Object outer=new JSONTokener(result).nextValue();JSONObject response=new JSONObject((String)outer);if(!response.optBoolean("ok")){finishRead(response.optString("error","成绩解析失败"));return;}reading=false;CookieManager.getInstance().flush();portalDialog.dismiss();}catch(Exception error){finishRead("成绩未能保存，原有成绩已保留");}});
 }
 private void copyPortalReport(){
  Uri uri=portalView==null?null:Uri.parse(portalView.getUrl()==null?"":portalView.getUrl());
  String report="课间 0.6.0 · 读取诊断\n设备："+Build.MANUFACTURER+" "+Build.MODEL+" / Android "+Build.VERSION.RELEASE+"\n页面："+(uri==null?"未知":uri.getHost()+String.valueOf(uri.getPath()))+"\n提前采集："+earlyCollector+"\n受限帧消息："+frameMessages+"\n已注入页面数："+capturedFrames+"\n查询数："+capturedRequests+"\n捕获课表数据："+(capturedTimetable!=null)+"\n读取进行中："+reading+"\n同步学期：自动 · "+(gradeScopeKnown?gradeScope():"待识别学校页面")+"\n成绩页面状态："+gradeState+"\n成绩读取方式："+gradeSource+"\n页面识别门数："+gradePageRecords+"\n成绩读取说明："+gradeReason;
  android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);clipboard.setPrimaryClip(android.content.ClipData.newPlainText("课间读取诊断",report));Toast.makeText(this,"诊断已复制，不包含验证码、Cookie 或课表内容",Toast.LENGTH_LONG).show();
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==42){if(fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}return;}if(request!=41)return;String content=pendingExport;byte[] bytes=pendingBinary;pendingExport=null;pendingBinary=null;if(result!=RESULT_OK||data==null||content==null&&bytes==null)return;try(OutputStream stream=getContentResolver().openOutputStream(data.getData())){if(stream==null)throw new Exception();if(bytes!=null)stream.write(bytes);else{java.io.Writer writer=new java.io.OutputStreamWriter(stream,StandardCharsets.UTF_8);writer.write(content);writer.flush();}appView.evaluateJavascript("window.onNativeExportResult&&window.onNativeExportResult('文件已保存')",null);}catch(Exception ignored){appView.evaluateJavascript("window.onNativeExportResult&&window.onNativeExportResult('保存失败，请重试')",null);}}

 private void handlePortalBack(){if(portalDialog==null||!portalDialog.isShowing())return;if(portalView!=null&&portalView.canGoBack())portalView.goBack();else portalDialog.dismiss();}
 private void handleAppBack(){
  if(portalDialog!=null&&portalDialog.isShowing()){handlePortalBack();return;}
  if(appView==null){moveTaskToBack(true);return;}
  if(appBackPending)return;appBackPending=true;
  appView.evaluateJavascript("(function(){return typeof window.handleAppBack==='function'&&window.handleAppBack();})()",result->{
   appBackPending=false;if(isFinishing()||isDestroyed()||"true".equals(result))return;
   if(appView!=null&&appView.canGoBack())appView.goBack();else moveTaskToBack(true);
  });
 }
 @Override public void onBackPressed(){handleAppBack();}
 @Override protected void onDestroy(){if(Build.VERSION.SDK_INT>=33&&appBackCallback!=null)getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(appBackCallback);if(portalDialog!=null&&portalDialog.isShowing())portalDialog.dismiss();if(appView!=null){appView.removeJavascriptInterface("CourseCompass");appView.destroy();}super.onDestroy();}
}
