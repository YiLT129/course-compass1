# 课间 Android 预览 0.2.0

新版从 /demo/index.html 进入；原版 /index.html 保留。安卓内置新版，首次启动即可离线使用。

已实现：全屏壁纸、半透明背景模糊、浮动导航、浅色/深色、图片比例裁剪/拖动/双指缩放/重新裁剪；学校 PDF 与 JSON 在本机解析，预览和确认更新；个人安排独立保留；学期作息设置；JSON 备份、ICS 学校课程日历；PWA 离线资源。

安卓使用独立学校 WebView 在 https://portal.gzist.edu.cn/ 完成官方认证。只允许广州理工学院 portal、ids、jw 官方主机在登录窗口内导航；本地应用的原生桥不会暴露给学校页面。Cookie 由系统 WebView 保存。首次读取在已登录课表页重新查询，采集已返回的 kbList 和同源课表查询方法/参数；后续手动同步复用该查询，过期或空结果要求重新查询。同步前显示新增/移除记录并由用户确认，不启用后台定时同步。

实际登录/验证码/学校同步尚未完成真机验收，不能保证学校 WebView 兼容或未来接口不变。网页端因会话隔离，提供本地 PDF/JSON 导入，不假装已绑定教务。

PDF 解析器支持当前正方文字课表布局（星期列、节次周次与校区/场地/教师字段），不支持扫描图或任意学校 PDF。已用五页文件核对 62 条记录，但文件与个人数据均未包含在网站或 APK。

架构：core 为数据与裁剪规则；adapters 为学校格式解析；demo 为界面；collector 为学校页面采集；android 为设备能力。PDF.js 5.6.205 使用 Apache-2.0，许可证位于 vendor/pdfjs/LICENSE。视觉参考 Telegram 官方开源客户端的壁纸层和模糊层思想，自行实现页面样式，未复制 Telegram 源码或商标。

- Android 背景模糊参考：https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/Components/SizeNotifierFrameLayout.java
- iOS 壁纸层参考：https://github.com/TelegramMessenger/Telegram-iOS/blob/master/submodules/WallpaperBackgroundNode/Sources/WallpaperBackgroundNode.swift
