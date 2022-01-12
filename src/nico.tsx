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

import { GetMessageRootType, GetMessagesType, MessageType, startObserver } from './common';

const getMessageRoot: GetMessageRootType = () => document.querySelector('div[class^=___table___]');

const parseMessage = (message: Element) => {
  const type = 'nico';
  const id = message.querySelector('span[class^=___comment-number___]')?.textContent ?? '';
  const status = '';
  const img = '';
  const now = new Date();
  const timestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const authorName = message.querySelector('span[class^=___comment-author-name___]')?.textContent ?? '';
  const messageText = message.querySelector('span[class^=___comment-text___]')?.textContent ?? '';
  const messageHtml = messageText;
  return { type, id, status, img, timestamp, authorName, messageHtml, messageText } as MessageType;
};

const getMessages: GetMessagesType = (messageRoot) => (
  Array.from(messageRoot.querySelectorAll('div[class^=___table-row___]'))
    .map(parseMessage)
    .filter((m) => m.id)
);

let observer: MutationObserver | null = null;

window.addEventListener('load', () => {
  observer?.disconnect();
  observer = startObserver(getMessageRoot, getMessages, 3000);
});

window.addEventListener('unload', () => {
  observer?.disconnect();
});
