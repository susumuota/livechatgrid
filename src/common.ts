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
  readonly isEnabled: boolean,
  readonly timerIntervalMs: number,
  readonly ytSendDelayMs: number,
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
  /** Enable/disable observer. */
  isEnabled: true,
  /** Timer interval to update observer. */
  timerIntervalMs: 5000,
  /**
   * Delay milliseconds for YouTube Live chat messages.
   * Set both delays to 0 if you don't need to synchronize 2 live streaming.
   * In my case, when I watch both streaming simultaneously (e.g., WNL),
   * `{ ytSendDelayMs: 0, nicoSendDelayMs: 3000 }`
   * because nico is 3 seconds faster than yt.
   */
  ytSendDelayMs: 0,
  /** Delay milliseconds for Niconico Live chat messages. */
  nicoSendDelayMs: 3000, // if nico is 3 seconds faster than yt.
  /** Number of columns of the grid. */
  columns: 3,
  /** Number of rows of the grid. */
  rows: 10,
  /**
   * Column width of the cell on the grid.
   * e.g., `1fr`, `20rem`, `200px`.
   */
  columnWidth: '1fr',
  /**
   * Row height of the cell on the grid.
   * Specify `(1.5 * N + 2)rem` for N lines.
   * e.g., `5rem` for 2 lines, `6.5rem` for 3 lines.
   */
  rowHeight: '5rem',
  /**
   * Margin height for auto scroll.
   * Only effective when `{ isFixGrid: false }`.
   * Increase when it fails to auto scroll.
   */
  marginScroll: 200,
  /** Enable/disable fixed grid mode. */
  isFixedGrid: true,
  /** Window width. */
  width: 1200,
  /**
   * Window height.
   * e.g., `844` 16px * (5rem * 10rows + 1margin) + 28px, last 28 might depend on the OS.
   */
  height: 16 * (5 * 10 + 1) + 28,
  /** Window position, left. */
  left: 0,
  /** Window position, top. */
  top: 0,
  /** Chat message box fade-in timeout milliseconds.  */
  fadeTimeoutEnter: 1000,
  /** Chat message box fade-out timeout milliseconds.  */
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
    const newMessages = messages.filter((m) => !ids.includes(m.id));
    setMessages(newMessages);
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
    if (!config || !config.isEnabled) {
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
