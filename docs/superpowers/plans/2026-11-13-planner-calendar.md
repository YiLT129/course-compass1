# 日程周视图与提醒送达 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** 让用户快速找到日程，并让 Android 到点提醒不依赖 WebView 仍活着。
**Architecture:** 本地周日历与现有日程存储共用；Android 闹钟在写入后登记，原生队列根据明确的前台确认选择系统通知。既有通知类别和存储键沿用。
**Tech Stack:** ES modules, CSS, Java, AlarmManager/NotificationManager, JVM and browser tests.
**Spec:** docs/superpowers/specs/2026-11-13-planner-calendar-design.md

- [ ] 对旧版复现未确认提醒没有后续闹钟的队列缺口。验证保存、清进程、前台未确认、已确认去重、过期或编辑删除。
- [ ] 加独立底栏与 7 天视图，验证不同月份、周末、跨周、窄屏、深色、旧数据、编辑与通知入口。
- [ ] 验证试响/权限/状态，运行回归、签名 APK、同源覆盖升级，发布 GitHub 与现有网站。
