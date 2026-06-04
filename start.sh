#!/bin/bash
# CoDraw 无人岛无限画布 — 一键启动
cd "$(dirname "$0")"
exec python backend/app.py
