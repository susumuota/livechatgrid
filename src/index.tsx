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

import React, { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Box, createTheme, CssBaseline, Fade, Paper, ThemeProvider, Typography } from '@mui/material';

import { ConfigType, getConfig, getConfigValue, MessageType, setConfigValue } from './common';

const useConfig = <K extends keyof ConfigType>(
  configName: K, initialState: ConfigType[K],
): [ConfigType[K], React.Dispatch<React.SetStateAction<ConfigType[K]>>] => {
  const [state, setState] = useState<ConfigType[K]>(initialState);

  // load
  useEffect(() => {
    const loadConfig = async () => {
      setState(await getConfigValue(configName));
    };
    loadConfig();
  }, []);

  // save
  useEffect(() => {
    setConfigValue(configName, state);
  }, [state]);

  // update
  const handleChanged = useCallback(async (changes: object, namespace: string) => {
    if (namespace !== 'local') return;
    Object.keys(changes).map(async (key) => {
      if (key === configName) setState(await getConfigValue(configName));
      return key;
    });
  }, []);

  useEffect(() => {
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [handleChanged]);

  return [state, setState];
};

function MessageHeader({ message }: { message: MessageType }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <span dangerouslySetInnerHTML={{ __html: message.img }} />
      <Typography variant="caption" sx={{
        opacity: 0.7,
        ml: 1,
        flexGrow: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        '&:hover': {
          overflowY: 'auto',
          whiteSpace: 'normal',
          textOverflow: 'clip',
        },
      }}>
        {message.authorName}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {message.timestamp}
      </Typography>
    </Box>
  );
}

// eslint-disable-next-line max-len
function MessagePaper({ message, fadeTimeoutEnter, fadeTimeoutExit }: { message: MessageType, fadeTimeoutEnter: number, fadeTimeoutExit: number }) {
  const [hoverSx, setHoverSx] = useState({});
  const paperRef = useRef<HTMLDivElement>(null);

  const paperSx = {
    p: 1,
    m: 1,
    opacity: 0.9,
    overflow: 'hidden',
    ...hoverSx,
  };

  useEffect(() => {
    if (paperRef.current && paperRef.current.scrollHeight > paperRef.current.clientHeight) {
      setHoverSx({
        '&:hover': {
          overflowY: 'auto',
          whiteSpace: 'normal',
          textOverflow: 'clip',
          zIndex: 1,
          height: 'calc(200% - 1rem)', // `${paperRef.current.scrollHeight}px`,
          transition: 'height 10s',
        },
      });
    }
  }, [paperRef.current]);

  return (
    <Fade in={message.status !== 'fadeout'} timeout={{ enter: fadeTimeoutEnter, exit: fadeTimeoutExit }}>
      <Paper sx={paperSx} ref={paperRef}>
        {message.type === 'yt' ? <MessageHeader message={message} /> : ''}
        <Box>
          <Typography>
            <span dangerouslySetInnerHTML={{ __html: message.messageHtml }} />
          </Typography>
        </Box>
      </Paper>
    </Fade>
  );
}

function App({ initialConfig }: { initialConfig: ConfigType }) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isAutoScroll, setAutoScroll] = useState(true);
  const [isNeedScroll, setNeedScroll] = useState(false);

  const [columns] = useConfig('columns', initialConfig.columns);
  const [rows] = useConfig('rows', initialConfig.rows);
  const [columnWidth] = useConfig('columnWidth', initialConfig.columnWidth);
  const [rowHeight] = useConfig('rowHeight', initialConfig.rowHeight);
  const [marginScroll] = useConfig('marginScroll', initialConfig.marginScroll);
  const [isFixedGrid] = useConfig('isFixedGrid', initialConfig.isFixedGrid);
  const [fadeTimeoutEnter] = useConfig('fadeTimeoutEnter', initialConfig.fadeTimeoutEnter);
  const [fadeTimeoutExit] = useConfig('fadeTimeoutExit', initialConfig.fadeTimeoutExit);

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
        const next = (prev.length > maxMessages) ? prev.slice(-maxMessages) : [...prev];
        // override data
        cursor %= maxMessages;
        unique.map((m) => {
          next[cursor] = m;
          cursor = (cursor + 1) % maxMessages;
          return m;
        });
        // fadeout the oldest message
        const index = cursor % maxMessages;
        if (next[index]) next[index] = { ...next[index], status: 'fadeout' } as MessageType;
        return next;
      }
      // remove messages by (columns * n) to keep layout
      const next = [...prev, ...unique];
      return (next.length > maxMessages)
        ? next.slice(columns * Math.ceil((next.length - maxMessages) / columns)) : next;
    });
    setNeedScroll(!isFixedGrid);
    sendResponse({ message: 'index.tsx: setMessages: done' });
    return true;
  }, [columns, rows, isFixedGrid]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (isNeedScroll && isAutoScroll) lastRef.current?.scrollIntoView({ block: 'start', inline: 'start' });
    setNeedScroll(false);
  }, [isNeedScroll, isAutoScroll, lastRef]);

  const handleScroll = useCallback(() => {
    setAutoScroll(window.innerHeight + window.scrollY > document.body.offsetHeight - marginScroll);
  }, [marginScroll]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const boxSx = {
    m: 1,
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, ${columnWidth})`,
    gridTemplateRows: `repeat(${rows}, ${rowHeight})`,
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Box sx={boxSx}>
        {messages.map((m) => (
          <MessagePaper
            key={m.id}
            message={m}
            fadeTimeoutEnter={fadeTimeoutEnter}
            fadeTimeoutExit={fadeTimeoutExit}
          />
        ))}
      </Box>
      <Box ref={lastRef} />
    </ThemeProvider>
  );
}

window.addEventListener('load', async () => {
  const config: ConfigType = await getConfig();
  ReactDOM.render(<App initialConfig={config} />, document.getElementById('app'));
});
