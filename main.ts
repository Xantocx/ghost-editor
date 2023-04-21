import { app, BrowserWindow } from "electron"
import { GhostApp } from "./src/app/app"

GhostApp.start(app, BrowserWindow)