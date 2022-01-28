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

const toISOString = (timestamp: string, startDate: Date | null) => {
  const matchesLive = timestamp.match(/^(\d{1,2}):(\d{2}) ([AP]M)$/);
  if (matchesLive) { // live, timestamp means current time
    const [, hour, minute, meridiem]: string[] = matchesLive;
    if (!hour || !minute || !meridiem) return timestamp;
    const date = new Date();
    date.setHours((parseInt(hour, 10) % 12) + (meridiem === 'AM' ? 0 : 12));
    date.setMinutes(parseInt(minute, 10));
    if (date.getTime() > Date.now()) date.setTime(date.getTime() - 1000 * 60 * 60 * 24);
    return date.toISOString();
  }
  // archive, timestamp means counted time from the beginning of the video
  if (!startDate) return new Date().toISOString();
  const hms = timestamp.split(/:/);
  // TODO: timestamp is negative time, e.g. -1:20
  const time = 1000 * (
    parseInt(hms?.pop() ?? '0', 10) + parseInt(hms?.pop() ?? '0', 10) * 60 + parseInt(hms?.pop() ?? '0', 10) * 60 * 60
  );
  const date = new Date();
  date.setTime(startDate.getTime() + time);
  return date.toISOString();
};

/** Parse element to object */
const parseMessage = (message: Element, startDate: Date | null) => {
  const type = 'yt';
  const { id } = message;
  const status = '';
  const img = message.querySelector('#img')?.getAttribute('src') ?? '';
  const timestamp = toISOString(message.querySelector('#timestamp')?.textContent ?? '', startDate);
  const authorName = message.querySelector('#author-name')?.textContent ?? '';
  const messageHtml = message.querySelector('#message')?.innerHTML.replace(/(class=".+?")/g, 'style="vertical-align: middle" width="16" height="16"') ?? '';
  // TODO: sanitize?
  const messageText = message.querySelector('#message')?.innerHTML.replace(/<img .+ alt="(.+?)" .+>/g, '$1').replace(/<.+>/g, '') ?? '';
  return { type, id, status, img, timestamp, authorName, messageHtml, messageText } as MessageType;
};

const getStartDate = () => {
  const startDateTag = document.querySelector('script#scriptTag')?.textContent?.match(/"startDate":"(.+?)",/)?.[1];
  return startDateTag ? new Date(startDateTag) : null;
};

/** Get live chat messages */
const getMessages = (messageRoot: Element) => {
  const startDate = getStartDate();
  return Array.from(messageRoot.querySelectorAll('yt-live-chat-text-message-renderer')).map((m) => parseMessage(m, startDate));
};

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
