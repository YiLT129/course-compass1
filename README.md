# 课间 · Course Compass

一个可以装点自己、离线使用的大学课表。轻盈玻璃界面，共用网页与 Android 数据模型。

## 功能

- 一屏五天/七天课表，连排课程按单个节次显示；按本机时间与已保存作息显示当前课、课间和下一节。
- 课程详情与搜索、今日安排、个人安排、学期与作息设置。
- 课表字号/每节高度/间距可调，紧凑与舒展预设；当前课程胶囊可展开查看教室与下一节。
- 自选壁纸、比例裁剪、拖动缩放、深浅主题；自动分析壁纸明暗提高文字可读性，外观实时预览。
- 课程独立配色；按日期和节次设置单次教室或停课，保留原始教务记录和后续同步。
- 贴纸、留言、倒数日、HTTPS快捷入口；拖动摆放、缩放旋转、图层、锁定、撤销重做、自动对齐；重启保留。
- 简洁玻璃 / 像素时钟 / 唱片卡片，选择课程、时间日期或一句话；可显示在应用内和Android桌面。
- Android 可选锁屏课程通知；锁屏外观由系统决定，系统不一定允许直接放置桌面组件。
- 正方JSON、兼容布局的正方文字PDF、通用CSV/Excel粘贴表格、标准课程JSON；先预览再更新。
- 完整备份恢复（课程、个人安排、原图/裁剪图、主题与本机记录）、主题包分享、PNG课表海报、ICS课程日历。
- 版本检查与覆盖升级；升级前本机恢复点、最近5次导入变化与撤回上次导入。网页有更新时手动切换，数据与照片保存在本机。

最新下载：[GitHub Releases](https://github.com/YiLT129/course-compass1/releases)。安卓直接覆盖安装，保留原包名和签名；请勿先卸载。

## 平台与适配边界

| 能力 | Android | iPhone / iPad 主屏幕网页 |
| --- | --- | --- |
| 课表、壁纸、挂件、应用内个性卡片 | 支持 | 支持，需HTTPS |
| 本地PDF/JSON/CSV导入 | 支持 | 支持；PDF需兼容文字布局 |
| 学校官方页面登录与自动读取 | 内置广州理工流程；其他正方同结构为试验接入 | 暂不支持跨域自动同步；使用文件/表格导入 |
| 桌面系统小组件 | 支持三种风格，各组件独立设置 | 尚未实现原生WidgetKit扩展 |
| 锁屏课程提示 | 可选系统通知 | 尚未实现原生扩展 |

在iPhone的Safari中打开部署网址，分享 → 添加到主屏幕。网页版无需IPA；尚未提供签名的iOS原生安装包。主屏幕网页安装与锁屏WidgetKit是两种不同能力。[Apple安装说明](https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/ios)、[WidgetKit](https://developer.apple.com/documentation/widgetkit)。

“任意学校可用”指通用录入和本地管理；各学校的自动登录、验证码、教务页面与数据接口仍需逐项适配。不会把未验证的学校标记为已支持。学校设置中的试验接入仅复用同结构正方接口，不猜测其他系统的接口。

## 本地运行

Node.js20+，网页无需安装依赖：

```sh
npm start
npm test
```

预览 http://127.0.0.1:4173/demo/index.html 。此地址仅供本机；手机使用请把 `dist/` 部署到HTTPS静态托管。PWA从现代界面启动，原版保留在 `/index.html`。

## Android构建

JDK17、Gradle8.11.1、Android SDK35 / Build Tools35；首次构建需下载依赖。

```sh
node scripts/sync-android.mjs
cd android
gradle :app:assembleDebug
```

也可在Android Studio打开 `android/`，配置SDK与Gradle。当前没有分发Gradle wrapper二进制。输出 `android/app/build/outputs/apk/debug/app-debug.apk`。最低Android8；版本0.5.0（17）。正式分发应使用自己的签名密钥。旧安装更新需同包名、同证书及更高版本号；卸载可能删除本机数据。

```sh
python scripts/verify-apk-startup.py android/app/build/outputs/apk/debug/app-debug.apk
```

## 使用与贡献

菜单 → 学校与导入方式：内置学校、任意学校通用模式或填写自定义学校。学校切换保留当前课表，成绩和身份按学校隔离；导入新课表时始终预览确认。首次使用请核对第一周周一、周数与作息。

- [学校适配开发](docs/ADAPTERS.md)
- [个性化与平台能力](docs/PERSONALIZATION.md)
- [隐私说明](PRIVACY.md)
- [贡献指南](CONTRIBUTING.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)
- [验证范围](docs/VALIDATION.md)

原创应用代码使用MIT许可证。PDF.js、字体与AndroidX保留各自许可证。不是学校官方客户端，不使用学校或Telegram的品牌素材。
