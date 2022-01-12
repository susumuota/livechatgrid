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

import React, { createRef, useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Box, createTheme, CssBaseline, Paper, ThemeProvider, Tooltip, Typography, Zoom } from '@mui/material';

import { ConfigType, DEFAULT_CONFIG, getConfig, MessageType, setConfig } from './common';

// eslint-disable-next-line @typescript-eslint/comma-dangle, max-len
const useConfig = <T,>(configName: keyof ConfigType): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(DEFAULT_CONFIG[configName] as unknown as T);

  const handleChanged = useCallback(async (changes: object, namespace: string) => {
    if (namespace !== 'local') return;
    const config = await getConfig();
    Object.keys(changes).map((key) => {
      if (key === configName) setState(config[configName]);
      return key;
    });
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getConfig();
      setState(config[configName]);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    setConfig({ [configName]: state });
  }, [state]);

  useEffect(() => {
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [handleChanged]);

  return [state, setState];
};

const createDummyMessages = (size: number) => {
  const dummy = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    return { type: 'dummy', id, status: '', img: '', timestamp: '', authorName: '', messageHtml: '', messageText: '' } as MessageType;
  };
  return [...Array<number>(size).keys()].map(dummy);
};

function MessageHeader({ message }: { message: MessageType }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <span dangerouslySetInnerHTML={{ __html: message.img }} />
      <Tooltip title={message.authorName}>
        <Typography variant="caption" sx={{ opacity: 0.7, ml: 1, flexGrow: 1 }} noWrap>
          {message.authorName}
        </Typography>
      </Tooltip>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {message.timestamp}
      </Typography>
    </Box>
  );
}

function MessagePaper({ message }: { message: MessageType }) {
  const paperSx = {
    p: 1,
    m: 1,
    opacity: message.status ? parseFloat(message.status) : 0.9,
    overflow: 'hidden',
    '&:hover': { overflow: 'auto' },
  };

  return (
    <Zoom in={true}>
      <Paper sx={paperSx}>
        {message.type === 'yt' ? <MessageHeader message={message} /> : ''}
        <Box>
          <Typography>
            <span dangerouslySetInnerHTML={{ __html: message.messageHtml }} />
          </Typography>
        </Box>
      </Paper>
    </Zoom>
  );
}

function App() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isAutoScroll, setAutoScroll] = useState(true);
  const [isNeedScroll, setNeedScroll] = useState(false);

  const [columns] = useConfig<number>('columns');
  const [rows] = useConfig<number>('rows');
  const [rowHeight] = useConfig<string>('rowHeight');
  const [marginScroll] = useConfig<number>('marginScroll');
  const [isFixedGrid] = useConfig<boolean>('isFixedGrid');

  const theme = useMemo(() => createTheme({ palette: { mode: 'dark' } }), []);
  const lastRef = useMemo(() => createRef<HTMLDivElement>(), []);

  let cursor = 0; // TODO: state?
  const handleMessage = useCallback((request: { type: 'setMessages', messages: MessageType[] }, _, sendResponse) => {
    if (request.type !== 'setMessages') return true;
    setMessages((prev) => {
      const maxMessages = columns * rows;
      const ids = prev.map((m) => m.id);
      const unique = request.messages.filter((m) => !ids.includes(m.id)); // TODO: need sort?
      if (isFixedGrid) {
        // padding dummy data if needed
        const next = (prev.length < maxMessages)
          ? [...prev, ...createDummyMessages(maxMessages - prev.length)]
          : prev.slice(-maxMessages);
        console.assert(next.length === maxMessages);
        // override data
        cursor %= maxMessages;
        unique.map((m) => {
          next[cursor] = m;
          cursor = (cursor + 1) % maxMessages;
          return m;
        });
        // change 3 messages darker
        [...Array<number>(3).keys()].map((i) => {
          const index = (cursor + i) % maxMessages;
          next[index] = { ...next[index], status: (0.2 * i + 0.3).toString(10) } as MessageType;
          return i;
        });
        return next;
      }
      // if isFixedGrid === false
      // remove messages by (columns * n) to keep layout
      const next = [...prev, ...unique];
      return (next.length > maxMessages)
        ? next.slice(columns * (1 + Math.trunc((next.length - maxMessages) / columns)))
        : next;
    });
    setNeedScroll(!isFixedGrid);
    sendResponse({ message: 'index.tsx: setMessages: done' });
    return true;
  }, [columns, rows, isFixedGrid]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [handleMessage]);

  useEffect(() => {
    if (isNeedScroll && isAutoScroll) lastRef.current?.scrollIntoView({ block: 'start', inline: 'start' /* , behavior: 'smooth' */ });
    setNeedScroll(false);
  }, [isNeedScroll, isAutoScroll, lastRef]);

  useEffect(() => {
    // eslint-disable-next-line max-len
    const handleScroll = () => setAutoScroll(window.innerHeight + window.scrollY > document.body.offsetHeight - marginScroll);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [marginScroll]);

  const boxSx = {
    m: 1,
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridAutoRows: `minmax(auto, ${rowHeight})`,
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Box sx={boxSx}>
        {messages.map((m) => <MessagePaper key={m.id} message={m} />)}
      </Box>
      <Box ref={lastRef} />
    </ThemeProvider>
  );
}

ReactDOM.render(<App />, document.getElementById('app'));
