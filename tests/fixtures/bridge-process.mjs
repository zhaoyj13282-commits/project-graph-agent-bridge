// Protocol double only: no PRG serialization or graph writes.
const names=['get_all_nodes','create_text_node','edit_text_node','create_edges','delete_nodes','auto_layout_dag'];
const definition=name=>({name,description:'Protocol test',inputSchema:{type:'object',properties:{}}});
const args=process.argv.slice(2);
if(args[0]==='--version') console.log('bridge-protocol-test');
else if(args[1]==='list') console.log(JSON.stringify(names.map(definition)));
else if(args[1]==='describe') console.log(JSON.stringify(definition(args[2])));
else console.log(JSON.stringify({objects:[{ref:'n1',type:'TextNode',text:'中文 "quoted"'}]}));
