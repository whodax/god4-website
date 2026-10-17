const {test,expect}=require('@playwright/test');
const net=require('node:net');
const {once}=require('node:events');
const {startCspServer}=require('./csp-server');

for(const partialRequest of [false,true]){
  test(`CSP server closes ${partialRequest?'an incomplete HTTP request':'an unused browser preconnection'}`,async()=>{
    const server=await startCspServer();
    const socket=net.createConnection({host:'127.0.0.1',port:Number(new URL(server.origin).port)});
    const errors=[];
    socket.on('error',error=>errors.push(error));
    try{
      await once(socket,'connect');
      // Neither connection has a completed HTTP request for idle-HTTP cleanup to reap.
      if(partialRequest) await new Promise((resolve,reject)=>socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n',error=>error?reject(error):resolve()));
      // Destroying a transport with unread request bytes may reset it on Windows.
      // Observe close separately: events.once would reject on that expected reset.
      const disconnected=new Promise(resolve=>socket.once('close',resolve));
      await server.close();
      await disconnected;
      expect(socket.destroyed).toBe(true);
      for(const error of errors) expect(error.code).toBe('ECONNRESET');
    }finally{
      socket.destroy();
      await server.close();
    }
  });
}
