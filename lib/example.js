zmq = require("zeromq")
fs = require("fs")

var config = JSON.parse(fs.readFileSync(process.argv[2]))

var connexion = "tcp://"+config.ip+":"
var shell_conn = connexion+config.shell_port
var pub_conn = connexion+config.iopub_port
var hb_conn = connexion+config.hb_port



var util = require('util'),
    vm = require('vm'),
    initSandbox = {},
    context = vm.createContext(initSandbox);


var hb_socket = zmq.createSocket('rep');
hb_socket.bind(hb_conn)

hb_socket.on('message',
        function(data){
            console.log("wtf ?");
            hb_socket.send(data);
        });

var pub_socket = zmq.createSocket('pub');
pub_socket.bind(pub_conn);


var reply_socket = zmq.createSocket('xrep')
reply_socket.bind(shell_conn)

reply_socket.on('message',
        function(data){
            for(i in arguments){
               console.log("["+i+"]: "+arguments[i].toString())
            }

            var parent_header = JSON.parse(arguments[3].toString());

            var unparsed_content = arguments[6];
            if(unparsed_content != undefined ) {
                var content = JSON.parse(unparsed_content.toString());
            }

            var code = content?content.code:undefined;
            var result
            if(code != undefined){
                result = vm.runInContext(code , context, '<kernel>');
            } else {
                result = 'undefined'
            }

            var header_reply ={
                msg_id:1,
                session:parent_header.session,
                msg_type:"execute_reply",
            }


            var ident = "";
            var delim =  "<IDS|MSG>"
            var signature = ""
            var metadata = {}

            var content = JSON.stringify({
                    execution_count:1,
                    data:{
                        "text/plain":result?result.toString():"undefined"
                    }
                })



            var header_pub ={
                msg_id:1,
                session:parent_header.session,
                msg_type:"pyout",
            }

            pub_socket.send([
                    ident,
                    delim,
                    signature,
                    JSON.stringify(header_pub),
                    JSON.stringify(parent_header),
                    JSON.stringify(metadata),
                    content])

            reply_socket.send([
                    ident,
                    delim,
                    signature,
                    JSON.stringify(header_reply),
                    JSON.stringify(parent_header),
                    JSON.stringify(metadata),
                    content
                ]);

            })


reply_socket.on('error',
        function(data){
            console.log('error',data)
            })

