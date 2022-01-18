// -*- coding: utf-8 -*-

// Copyright 2022 Susumu OTA
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { getConfigValue, MessageType, setConfigValue } from './common';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'livechatgrid-menu',
    title: 'Live Chat Grid',
  });
  return true;
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'livechatgrid-menu') return true;
  const tab = await chrome.tabs.create({ url: 'index.html', active: false });
  const left = await getConfigValue<number>('left');
  const top = await getConfigValue<number>('top');
  const width = await getConfigValue<number>('width');
  const height = await getConfigValue<number>('height');
  chrome.windows.create({ tabId: tab.id, type: 'popup', focused: true, left, top, width, height });
  return true;
});

chrome.runtime.onMessage.addListener(
  (request: { type: string, messages: MessageType[] }, _, sendResponse) => {
    if (request.type !== 'setMessages') return true;
    request.messages.map((m) => {
      const out = m.type === 'yt' ? console.info : console.debug;
      out(`${m.type.padEnd(4, ' ')} ${m.timestamp} ${m.messageText} [${m.authorName}]`);
      return m;
    });
    sendResponse({ message: 'background.ts: setMessages: done' });
    return true;
  },
);

chrome.windows.onBoundsChanged.addListener(async (window) => {
  if (!window.id) return;
  const tabs = await chrome.tabs.query({ windowId: window.id });
  if (!tabs || !tabs[0] || tabs[0].title !== 'Live Chat Grid') return;
  const { left, top, width, height } = window;
  if (!left || !top || !width || !height) return;
  setConfigValue<number>('left', left);
  setConfigValue<number>('top', top);
  setConfigValue<number>('width', width);
  setConfigValue<number>('height', height);
});
