# Android 0.2.2 启动修复

## 已确认的原因

0.2.0 / 0.2.1 的手工 Windows 打包流程产生了 202 个包含反斜杠的原始 ZIP 条目，例如 `assets/demo\index.html`。APK 中确实有文件内容，但 Android AssetManager 请求的是 `demo/index.html`，因此无法读取。根目录 `school.json` 和 `collector.js` 没有这个问题，说明为什么配置能加载、进入页面却失败。

早期检查误用了 Python `ZipInfo.filename`。该属性在 Windows 自动把反斜杠变成正斜杠，掩盖了错误。新检查使用 `orig_filename`，并增加 Java ZipFile 逐项读取验证。仅修正旧 APK 的 ZIP 路径、保持旧代码不变的对照包可以完整读取 212 个资源；原始旧包在 Java 检查中失败。

## 开源实现对照

- [Android 官方 WebView 示例](https://github.com/android/views-widgets-samples/tree/main/WebView)：采用 Android Gradle Plugin 打包资源，并使用 AndroidX WebViewAssetLoader 提供 HTTPS 本地页面。
- [Apache Cordova Android 的 SystemWebViewClient](https://github.com/apache/cordova-android/blob/master/framework/src/org/apache/cordova/engine/SystemWebViewClient.java)：使用 WebViewAssetLoader 将请求映射到内置资产，并处理资源 MIME。
- [Android 本地内容加载文档](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)：解释应用本地资源的 HTTPS 地址与路径映射。

本次参考其构建和资源加载方式，没有复制项目界面或整套第三方应用源码。

## 变更

1. 改用标准 Gradle `assembleDebug`，避免手工打包时的 Windows 路径问题。
2. 使用 AndroidX WebViewAssetLoader，入口为 `https://appassets.androidplatform.net/assets/demo/index.html`。
3. 保留读取本应用 APK 内置资源的后备通道；拒绝路径穿越，不读取外部文件。
4. 启动异常显示具体阶段、设备及错误，支持复制诊断信息。
5. 保持原有应用 ID 和签名，支持覆盖安装保留本地数据。

教务登录仍使用独立 WebView；采集器和同步逻辑保持原有方式。学校账号的实际登录、查询和同步仍需用户设备确认。
