import {Failure,Schema,Text,State,Uuid,Email,Word,HttpRemote,WsRemote,Collection,Multi} from './common';
export const Sdk = {"Ws":{"User":{"count":WsRemote.import({"name":"User.count" as const,"input":Schema.import({}),"output":State.import({"message":Text.import({"type":"optional" as const,"active":"string" as const,"inactive":"string" as const,"rules":[]})})})}},"Http":{"User":{"count":HttpRemote.import({"method":"get" as const,"path":"/user/count" as const,"input":Schema.import({}),"output":State.import({"message":Text.import({"type":"optional" as const,"active":"string" as const,"inactive":"string" as const,"rules":[]})})}),"list":HttpRemote.import({"method":"get" as const,"path":"/user" as const,"input":Schema.import({}),"output":Collection.import(State.import({"password":Text.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[]}),"id":Uuid.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"^[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}$" as const,"expect":true as const,"message":"must be a valid uuid" as const}]}),"email":Email.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])" as const,"expect":true as const,"message":"must be a valid email address" as const}]})}))}),"find":HttpRemote.import({"method":"get" as const,"path":"/user/:id" as const,"input":Schema.import({"id":Uuid.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"^[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}$" as const,"expect":true as const,"message":"must be a valid uuid" as const}]})}),"output":Multi.import([State.import({"password":Text.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[]}),"id":Uuid.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"^[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}$" as const,"expect":true as const,"message":"must be a valid uuid" as const}]}),"email":Email.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])" as const,"expect":true as const,"message":"must be a valid email address" as const}]})}),Failure])}),"create":HttpRemote.import({"method":"post" as const,"path":"/user" as const,"input":Schema.import({"email":Email.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])" as const,"expect":true as const,"message":"must be a valid email address" as const}]}),"password":Word.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":".{8}" as const,"expect":true as const,"message":"must be at least 8 characters" as const},{"regex":"[^\\w]" as const,"expect":false as const,"message":"must contain only alphanumeric characters" as const}]})}),"output":Multi.import([State.import({"password":Text.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[]}),"id":Uuid.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"^[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}$" as const,"expect":true as const,"message":"must be a valid uuid" as const}]}),"email":Email.import({"type":"required" as const,"active":"string" as const,"inactive":"string" as const,"rules":[{"regex":"(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])" as const,"expect":true as const,"message":"must be a valid email address" as const}]})}),Failure])})}}};
export {Failure,Schema,Text,State,Uuid,Email,Word,HttpRemote,WsRemote,Collection,Multi}