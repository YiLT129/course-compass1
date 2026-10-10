# 学校与教务系统适配

通用能力与学校自动连接独立。当前内置广州理工学院正方流程，曾由用户反馈确认课表/成绩读取成功；本轮无真实学校会话。其他高校未验证。

## 通用输入

CSV或Excel复制表格需表头：课程名称、星期、开始节次、结束节次、周次、教室、教师。前五列必需。星期1–7，节次1–12，周次1–60。含逗号的内容用CSV英文双引号包住。示例见 `examples/timetable.csv`。

标准课程记录 `{name,day,start,end,weeks,location,teacher,note,color}`；weeks可为数组或“1-16(单)”字符串。JSON可直接为课程数组，或使用 `{version:1,courses:[...],settings:{...}}`。任何记录错误都拒绝整批导入；不会悄悄丢课。

## 注册数据适配器

`dist/adapters/registry.js` 提供 `registerAdapter({id,title,detect,parse})`。parse返回统一模型，最终通过 `validateEnvelope` 与预览确认。新增文件应在原版和现代版的入口注册，再添加脱敏样例及失败测试。

## 学校配置

`dist/core/schools.js` 与 Android `SchoolConfig.java` 校验同一配置：id/name/adapter/loginUrl/timetableUrl/homeUrl/hosts。自定义学校必须HTTPS，登录域名逐个精确列出；禁止通配域名。仅内置校因其现有入口保留HTTP。Android数据采集仅限教务主机，SSO域名不会获得采集桥，更不会获得应用原生桥。

正方试验接入要求实际 `/jwglxt/kbcx/` 入口。采集器保留同源及只读课表请求限制。成绩脚本复用已观察到的同结构查询和手机页面，不代表不同版本的正方都可用。新系统（如强智、树维、学校自研）需要增加具体采集实现和解析器，配置登录网址本身不会自动实现数据读取。

添加适配器需提供：官方登录/查询路径、验证码或SSO流程、脱敏字段样例、分页/空数据/过期登录处理、是否需校园网。禁止上传Cookie、密码、验证码、完整学号和个人成绩截图。

## 验证标记

通用导入：本地格式验证；正方试验：仅同结构模拟测试；学校已验证：有人在实际会话确认，仍标注测试时间和系统版本。请勿把模拟测试称为已支持所有大学。
