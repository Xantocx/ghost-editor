/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

import { setupP5JS } from './editor/languages/p5js/config';
import GhostEditor from "./editor/index"
import Synchronizer from "./editor/utils/synchronizer"

setupP5JS()

const editorElement = document.getElementById('editor')
if (editorElement) {
    const synchronizer = new Synchronizer()
    new GhostEditor(editorElement, undefined, { synchronizer, enableFileManagement: true, enableSideView: true })
} else {
    throw new Error("No editor element in HTML!")
}
