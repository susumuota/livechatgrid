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
  readonly isActive: boolean,
  readonly timerIntervalMs: number,
  readonly nicoSendDelayMs: number,
  readonly columns: number,
  readonly rows: number,
  readonly columnWidth: string,
  readonly rowHeight: string,
  readonly marginScroll: number,
  readonly isFixedGrid: boolean,
  readonly width: number,
  readonly height: number,
  readonly left: number,
  readonly top: number,
  readonly fadeTimeoutEnter: number,
  readonly fadeTimeoutExit: number,
};

export const DEFAULT_CONFIG: ConfigType = {
  isActive: true,
  timerIntervalMs: 5000,
  nicoSendDelayMs: 3000,
  columns: 1,
  rows: 10,
  columnWidth: '1fr',
  rowHeight: '5rem', // 1.5 * 2 + 1 + 1
  marginScroll: 200,
  isFixedGrid: true,
  width: 400,
  // 16px * (5rem * 10rows + 1margin) + (window.outerHeight - window.innerHeight)
  height: 16 * (5 * 10 + 1) + 28,
  left: 0,
  top: 0,
  fadeTimeoutEnter: 1000,
  fadeTimeoutExit: 5000,
} as const;

export const setConfig = (config: ConfigType) => chrome.storage.local.set(config);

// "K extends keyof T", see
// https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints
// "T[K]", see
// https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html
export const setConfigValue = <K extends keyof ConfigType>(key: K, value: ConfigType[K]) => (
  chrome.storage.local.set({ [key]: value })
);

export const getConfig = (defaultConfig: ConfigType = DEFAULT_CONFIG) => (
  chrome.storage.local.get(defaultConfig) as Promise<ConfigType>
);

export const getConfigValue = async <K extends keyof ConfigType>(key: K) => (
  (await chrome.storage.local.get({ [key]: DEFAULT_CONFIG[key] }))[key] as ConfigType[K]
);

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

const startObserver = (
  messageRoot: Element,
  getMessages: (messageRoot: Element) => MessageType[],
  setMessages: (messages: MessageType[]) => void,
) => {
  const firstMessages = getMessages(messageRoot);
  setMessages(firstMessages);
  let ids = firstMessages.map((m) => m.id);
  const observer = new MutationObserver(() => {
    const messages = getMessages(messageRoot);
    const filteredMessages = messages.filter((m) => !ids.includes(m.id));
    setMessages(filteredMessages);
    ids = messages.map((m) => m.id);
  });
  observer.observe(messageRoot, { childList: true });
  return observer;
};

export const updateObserver = async (
  oldState: { observer: MutationObserver | null, messageRoot: Element | null },
  getMessageRoot: () => Element | null,
  getMessages: (messageRoot: Element) => MessageType[],
  setMessages: (messages: MessageType[]) => void,
) => {
  try {
    const { observer, messageRoot } = oldState;
    const config = await getConfig();
    if (!config || !config.isActive) {
      observer?.disconnect();
      return { observer: null, messageRoot: null };
    }
    const nextMessageRoot = getMessageRoot();
    if (!nextMessageRoot) {
      observer?.disconnect();
      return { observer: null, messageRoot: null };
    }
    if (messageRoot === nextMessageRoot) {
      return { observer, messageRoot };
    }
    observer?.disconnect();
    return {
      observer: startObserver(nextMessageRoot, getMessages, setMessages),
      messageRoot: nextMessageRoot,
    };
  } catch (err) {
    console.debug(err);
    return { observer: null, messageRoot: null };
  }
};
