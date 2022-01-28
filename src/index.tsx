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
import { Box, createTheme, CssBaseline, Fade, Icon, IconButton, Paper, ThemeProvider, Tooltip, Typography } from '@mui/material';

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
  const date = new Date(message.timestamp);
  const timestamp = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  return (
    <Box sx={{ display: 'flex', verticalAlign: 'middle' }}>
      <img src={message.img} style={{ borderRadius: '50%' }} width="16" height="16" />
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
        {timestamp}
      </Typography>
    </Box>
  );
}

function MessagePaper({
  message,
  fadeTimeoutEnter,
  fadeTimeoutExit,
}: { message: MessageType, fadeTimeoutEnter: number, fadeTimeoutExit: number }) {
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
          height: 'calc(200% - 1rem)', // `calc(${paperRef.current.scrollHeight}px + 1rem)`,
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

const overrideMessages = (
  prevMessages: MessageType[],
  newMessages: MessageType[],
  maxMessage: number,
  prevCursor: number,
): [MessageType[], number] => {
  const messages = (prevMessages.length > maxMessage)
    ? prevMessages.slice(-maxMessage) : [...prevMessages];
  // override data
  let cursor = prevCursor % maxMessage;
  newMessages.map((m) => {
    messages[cursor] = m;
    cursor = (cursor + 1) % maxMessage;
    return m;
  });
  // fadeout the oldest message
  const index = cursor % maxMessage;
  if (messages[index]) messages[index] = { ...messages[index], status: 'fadeout' } as MessageType;
  return [messages, cursor];
};

const appendMessages = (
  prevMessages: MessageType[],
  newMessages: MessageType[],
  maxMessage: number,
  columns: number,
) => {
  // remove messages by (columns * n) to keep layout
  const nextMessages = [...prevMessages, ...newMessages];
  return (nextMessages.length > maxMessage)
    ? nextMessages.slice(columns * Math.ceil((nextMessages.length - maxMessage) / columns))
    : nextMessages;
};

const showAppendFilePicker = async (
  options?: OpenFilePickerOptions & { multiple?: false | undefined },
) => {
  const [fh] = await window.showOpenFilePicker(options); // NOT window.showSaveFilePicker
  const ps = await fh.requestPermission({ mode: 'readwrite' });
  if (ps === 'granted') return fh;
  throw new Error('The user did not grant permission.');
};

const createAppendWritable = async (fileHandle: FileSystemFileHandle) => {
  const { size } = await fileHandle.getFile();
  const fs = await fileHandle.createWritable({ keepExistingData: true });
  await fs.seek(size);
  return fs;
};

const getBOM = () => {
  // https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf]);
  return new Blob([bytes.buffer]);
};

// TODO: use module?
const stringsToCSV = (data: string[]) => `"${data.map((f) => f.replace(/"/g, '""')).join('","')}"\n`;

const messageToCSV = (message: MessageType) => {
  // TODO: refine
  const { type, id, status, img, timestamp, authorName, messageHtml, messageText } = message;
  const data = [type, id, status, img, timestamp, authorName, messageHtml, messageText];
  return stringsToCSV(data);
};

const getCSVHeader = () => {
  // TODO: refine
  const data = ['type', 'id', 'status', 'img', 'timestamp', 'authorName', 'messageHtml', 'messageText'];
  return stringsToCSV(data);
};

function App({ initialConfig }: { initialConfig: ConfigType }) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [cursor, setCursor] = useState(0);
  const [isAutoScroll, setAutoScroll] = useState(true);
  const [isNeedScroll, setNeedScroll] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle>();

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

  const handleMessage = useCallback(async (request: { type: 'setMessages', messages: MessageType[] }, _, sendResponse) => {
    if (request.type !== 'setMessages' || !request.messages || request.messages.length === 0) return true;
    const maxMessage = columns * rows;
    const filterRegExp = await getConfigValue('filterRegExp');
    let nextCursor = cursor % maxMessage;
    let newMessages: MessageType[] = [];
    setMessages((prevMessages) => {
      const ids = prevMessages.map((m) => m.id);
      const uniqueMessages = request.messages.filter((m) => !ids.includes(m.id));
      newMessages = uniqueMessages.filter((m) => !(m.messageText.match(filterRegExp)));
      if (isFixedGrid) {
        const [nextMessages, c] = overrideMessages(prevMessages, newMessages, maxMessage, cursor);
        nextCursor = c;
        return nextMessages;
      }
      return appendMessages(prevMessages, newMessages, maxMessage, columns);
    });
    if (fileHandle && newMessages.length > 0) {
      try {
        const fs = await createAppendWritable(fileHandle);
        await fs.write(newMessages.map(messageToCSV).join(''));
        await fs.close();
      } catch (err) {
        console.debug(err);
      }
    }
    setCursor(nextCursor);
    setNeedScroll(!isFixedGrid);
    sendResponse({ message: 'index.tsx: setMessages: done' });
    return true;
  }, [cursor, fileHandle, columns, rows, isFixedGrid]);

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

  const handleOpen = useCallback(async () => {
    try {
      const fh = await showAppendFilePicker();
      setFileHandle(fh);
      const { size } = await fh.getFile();
      if (size !== 0) return;
      const fs = await createAppendWritable(fh);
      await fs.write(getBOM()); // for Excel
      await fs.write(getCSVHeader());
      await fs.close();
    } catch (err) {
      console.debug(err);
      setFileHandle(undefined);
    }
  }, []);

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
      <Tooltip title="Save chat to local file (CSV)">
        <IconButton sx={{ position: 'absolute', top: 0, right: 0, m: 1, p: 1, opacity: 0.1, '&:hover': { opacity: 0.9 } }} onClick={handleOpen}>
          <Icon>save_alt</Icon>
        </IconButton>
      </Tooltip>
      <Box ref={lastRef} />
    </ThemeProvider>
  );
}

window.addEventListener('load', async () => {
  const config: ConfigType = await getConfig();
  ReactDOM.render(<App initialConfig={config} />, document.getElementById('app'));
});
