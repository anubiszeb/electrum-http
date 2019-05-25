# electrumHttp
Nodejs server for doing electrum server over http. no need for socket, just get requests on urls. Uses tls on port 50002.

## Requirements
Requires node version 6.0 and above

## Installation
Install npm dependencies with command:
```
npm install
```

## Usage
Start the service with command:
```
npm start
```
Service will be started on 127.0.0.1:3456

## Example
http://localhost:3456/?server=proxy.genx.zelcore.io&call=history&param=CL19a3dereSFacjneBLJCK1QRXfG7Tm7Hh&port=50002&contype=tls

parameters - > call, server, param, port, contype

possible calls
balance = blockchainAddress_getBalance, param = address
history = blockchainAddress_getHistory, param = address 
transaction = blockchainTransaction_get, param = txid
utxo = blockchainAddress_listunspent, param = address
broadcast = blockchainTransaction_broadcast, param = rawtx
height = blockchainHeaders_subscribe, no parameter
header = blockchainBlock_getHeader, param = height

