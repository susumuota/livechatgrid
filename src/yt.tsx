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

import { getConfigValue, MessageType, updateObserver } from './common';

/** Get live chat element to observe */
const getMessageRoot = () => {
  const queryItems = (w: Window) => w.document.querySelector('div#items.yt-live-chat-item-list-renderer');
  if (window.frames.length === 0) return queryItems(window);
  const chatWindow = Array.from(window.frames).find((f) => f.frameElement?.id === 'chatframe');
  return chatWindow ? queryItems(chatWindow) : null;
};

const to24h = (timestamp: string) => {
  const m = timestamp.match(/(\d{1,2}):(\d{2}) ([AP]M)/);
  if (!m) return timestamp;
  const [, hour, minute, meridiem]: string[] = m; // meridiem === AM or PM
  if (!hour) return timestamp;
  const hour24 = (parseInt(hour, 10) % 12) + (meridiem === 'AM' ? 0 : 12);
  return `${hour24}:${minute}`;
};

/** Parse element to object */
const parseMessage = (message: Element) => {
  const type = 'yt';
  const { id } = message;
  const status = '';
  const img = message.querySelector('#img')?.outerHTML.replace(/(class=".+?")/g, 'style="border-radius: 50%" width="16" height="16"') ?? '';
  const timestamp = to24h(message.querySelector('#timestamp')?.textContent ?? '');
  const authorName = message.querySelector('#author-name')?.textContent ?? '';
  const messageHtml = message.querySelector('#message')?.innerHTML.replace(/(class=".+?")/g, 'style="vertical-align: middle" width="16" height="16"') ?? '';
  // TODO: sanitize
  const messageText = message.querySelector('#message')?.innerHTML.replace(/<img .+ alt="(.+?)" .+>/g, '$1').replace(/<.+>/g, '') ?? '';
  return { type, id, status, img, timestamp, authorName, messageHtml, messageText } as MessageType;
};

/** Get live chat messages */
const getMessages = (messageRoot: Element) => (
  Array.from(messageRoot.querySelectorAll('yt-live-chat-text-message-renderer')).map(parseMessage)
);

/** Set live chat messages to somewhere */
const setMessages = (messages: MessageType[]) => {
  try {
    chrome.runtime.sendMessage({ type: 'setMessages', messages }, (response) => {
      console.debug(chrome.runtime.lastError?.message ?? `received message: ${response.message}`);
    });
  } catch (err) {
    console.debug(err);
  }
};

let timer: NodeJS.Timer | null = null;
let messageRoot: Element | null = null;
let observer: MutationObserver | null = null;

window.addEventListener('yt-navigate-finish', async () => {
  console.debug('yt-navigate-finish');
  if (timer) clearInterval(timer);
  // TODO: adjust manifest.json
  if (!window.location.href.match(/^https:\/\/www\.youtube\.com\/watch\?v=.+/)) return;
  const timerIntervalMs = await getConfigValue('timerIntervalMs');
  const sendDelayMs = await getConfigValue('ytSendDelayMs');
  const setMessagesFunction = sendDelayMs > 0
    ? (messages: MessageType[]) => setTimeout(() => setMessages(messages), sendDelayMs)
    : setMessages;
  timer = setInterval(async () => {
    ({ observer, messageRoot } = await updateObserver(
      { observer, messageRoot },
      getMessageRoot,
      getMessages,
      setMessagesFunction,
    ));
  }, timerIntervalMs);
});

window.addEventListener('unload', () => {
  if (timer) clearInterval(timer);
  timer = null;
  observer?.disconnect();
  observer = null;
  messageRoot = null;
});
