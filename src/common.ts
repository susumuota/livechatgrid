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

export type ConfigType = {
  readonly columns?: number,
  readonly rows?: number,
  readonly rowHeight?: string,
  readonly marginScroll?: number,
  readonly isFixedGrid?: boolean,
  readonly createWindow?: {
    width?: number | undefined,
    height?: number | undefined,
    left?: number | undefined,
    top?: number | undefined,
    type?: string,
    focused?: boolean,
  },
};

export const DEFAULT_CONFIG = {
  columns: 1,
  rows: 10,
  rowHeight: '5em', // 1.5 * 2 + 2 === (1.5 line-height) * (2 lines) + (2 padding)
  marginScroll: 200,
  isFixedGrid: true,
  createWindow: {
    width: 400,
    height: 850,
    left: 0,
    top: 0,
    type: 'popup',
    focused: true,
  },
};

export const setConfig = (config: ConfigType) => chrome.storage.local.set(config);

// eslint-disable-next-line max-len
export const getConfig = (defaultConfig: ConfigType = DEFAULT_CONFIG) => chrome.storage.local.get(defaultConfig);

export const clearConfig = () => chrome.storage.local.clear();

export type MessageType = {
  type: string,
  id: string,
  status: string,
  img: string,
  timestamp: string,
  authorName: string,
  messageHtml: string,
  messageText: string,
};

export type GetMessageRootType = () => Element | null;

export type GetMessagesType = (messageRoot: Element) => MessageType[];

const sendSetMessages = (messages: MessageType[]) => {
  try {
    chrome.runtime.sendMessage({ type: 'setMessages', messages }, (response) => {
      console.debug(chrome.runtime.lastError?.message ?? `received message: ${response.message}`);
    });
  } catch (err) {
    console.debug(err);
  }
};

// eslint-disable-next-line max-len
export const startObserver = (getMessageRoot: GetMessageRootType, getMessages: GetMessagesType, delay: number) => {
  const messageRoot = getMessageRoot();
  if (!messageRoot) return null;
  const firstMessages = getMessages(messageRoot);
  sendSetMessages(firstMessages);
  let ids = firstMessages.map((m) => m.id);
  const observer = new MutationObserver(() => {
    const messages = getMessages(messageRoot);
    const filteredMessages = messages.filter((m) => !ids.includes(m.id));
    if (delay > 0) {
      setTimeout(() => sendSetMessages(filteredMessages), delay);
    } else {
      sendSetMessages(filteredMessages);
    }
    ids = messages.map((m) => m.id);
  });
  observer.observe(messageRoot, { childList: true });
  return observer;
};
