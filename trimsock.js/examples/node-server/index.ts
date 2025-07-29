import * as net from 'node:net';
import { makeDefaultIdGenerator } from '@foxssake/trimsock-js';
import { NodeSocketReactor } from '@foxssake/trimsock-node';

const port = 8890
const sessionIds: Map<net.Socket, string> = new Map()

const generateSessionId = makeDefaultIdGenerator(4)

new NodeSocketReactor()
  .on('info', (_, xchg) => xchg.replyOrSend({ name: 'info', data: 'trimsock on node'}))
  .on('whoami', (_, xchg) => xchg.replyOrSend({ name: 'whoami', data: sessionIds.get(xchg.source) || '???' }))
  .serve({}, (socket) => {
    const sessionId = generateSessionId()
    sessionIds.set(socket, sessionId)
    console.log('New session', sessionId)
  })
  .listen(port, () => console.log('Listening on port', port))
